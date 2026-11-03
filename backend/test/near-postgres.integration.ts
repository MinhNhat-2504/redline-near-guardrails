// REAL isolated Postgres + REAL SDK signatures; mocked chain ownership/transport.
// This does not assert that ephemeral test keys own any public NEAR account.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { KeyPair, KeyPairSigner, SignedTransaction, baseEncode } from "near-api-js";
import { NearAuth, FinalAccessProvider } from "../src/near/auth.js";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { NearChain, verifyExecutorPermission } from "../src/chain/near.js";
import { NearReceiptReader } from "../src/near/reader.js";
import { NearStore } from "../src/near/store.js";
import { NearIndexer } from "../src/near/indexer.js";
import { observeVaultTransaction } from "../src/near/receipts.js";
import { buildNearApp } from "../src/near/server.js";
import { nearConfig } from "../src/near/config.js";
import { NearRpcError } from "../src/near/rpc.js";
import { prepareOwnerAction } from "../src/near/owner-actions.js";
import { invalidateResetPacket } from "../src/near/key-recovery.js";
import { fixture as resetFixture } from "./near-key-reset-fixture.js";

const database = process.env.NEAR_TEST_DATABASE_URL;
if (!database) throw new Error("NEAR_TEST_DATABASE_URL required; never run these integration tests against an existing database");
const target = new URL(database);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/redline_near_test") throw new Error("Only isolated localhost redline_near_test is allowed");
const db = new PrismaClient({ datasources: { db: { url: database } } });
const OWNER = "owner-it.testnet", AGENT = "agent-it.testnet", VAULT = "nhat-redline-vault.testnet";
const key = KeyPair.fromRandom("ed25519");
const signer = new KeyPairSigner(key);
const publicKey = key.getPublicKey().toString();
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/phase2-${name}.json`, import.meta.url), "utf8")).result;
const testScopes: string[] = [];
const sessionIds: string[] = [];
const challengeIds: string[] = [];
let now = Date.now();
let permission: unknown = "FullAccess";
const provider = new FinalAccessProvider({ url: "https://rpc.testnet.near.org" });
const access = vi.spyOn(provider, "viewAccessKey").mockImplementation(async () => ({ permission: permission as never, nonce: 5n, block_hash: fixture("final-grant").block_hash, block_height: 100 }));
const auth = new NearAuth(db, provider, "redline.test", "https://redline.test/near/auth/callback", () => now);

async function proof(account = OWNER, clientType: "wallet" | "cli" = "wallet") {
  const challenge = await auth.challenge(account, clientType); challengeIds.push(challenge.challengeId);
  const signed = await signer.signNep413Message(account, { message: challenge.message, recipient: challenge.recipient,
    nonce: Buffer.from(challenge.nonce, "base64"), callbackUrl: challenge.callbackUrl });
  return { challenge, body: { challengeId: challenge.challengeId, state: challenge.state, accountId: account, publicKey, signature: Buffer.from(signed.signature).toString("base64") } };
}
async function login() {
  permission = "FullAccess"; const p = await proof(); const session = await auth.verify(p.body);
  sessionIds.push(createHash("sha256").update(session.token).digest("hex")); return session;
}
function scope() { const s = `testnet:it-${randomUUID()}`; testScopes.push(s); return s; }

beforeAll(async () => { await db.$connect(); });
afterAll(async () => {
  // Only records created by this file, inside a deliberately isolated database.
  await db.nearReceiptEvent.deleteMany({ where: { scope: { in: testScopes } } });
  await db.nearIntentRequest.deleteMany({ where: { scope: { in: testScopes } } });
  await db.nearTransaction.deleteMany({ where: { scope: { in: testScopes } } });
  await db.nearGrant.deleteMany({ where: { scope: { in: testScopes } } });
  await db.nearWatermark.deleteMany({ where: { scope: { in: testScopes } } });
  await db.nearChallenge.deleteMany({ where: { id: { in: challengeIds } } });
  await db.nearSession.deleteMany({ where: { tokenHash: { in: sessionIds } } });
  access.mockRestore(); await db.$disconnect();
});

describe("explicit key reset journal recovery (synthetic RPC, real isolated Postgres)", () => {
  async function scenario() {
    const { plan, input } = resetFixture();
    plan.contract = `recovery-${randomUUID().slice(0,8)}.testnet`;
    (input.access as any).permission.FunctionCall.receiver_id = plan.contract;
    const localScope = `testnet:${plan.contract}`; testScopes.push(localScope);
    const argsJson = JSON.stringify(plan.args);
    await db.nearTransaction.create({ data: { scope: localScope, hash: plan.oldHash, signerId: plan.executor,
      ownerId: plan.owner, grantId: plan.args.grant_id, intentId: plan.args.intent_id, argsJson,
      keyPublic: plan.publicKey, keyNonce: 10, signedBase64: "synthetic-packet-must-be-preserved", state: "SUBMISSION_UNKNOWN" } });
    await db.nearIntentRequest.create({ data: { scope: localScope, grantId: plan.args.grant_id, intentId: plan.args.intent_id, ownerId: plan.owner, argsJson, txHash: plan.oldHash } });
    const rpc = new NearReadOnlyRpc();
    vi.spyOn(rpc,"transaction").mockImplementation(async hash => {
      if (hash === plan.resetHash) return input.reset;
      throw new NearRpcError("REMOTE_ERROR","UNKNOWN_TRANSACTION");
    });
    vi.spyOn(rpc,"blockAtHash").mockResolvedValue(input.blocks[0]);
    vi.spyOn(rpc,"accessKey").mockImplementation(async (_account,key) => key === plan.publicKey ? input.access : input.signingAccess);
    vi.spyOn(rpc,"view").mockImplementation(async (_contract,method) => method === "get_grant" ? input.grant : method === "get_owner_balance" ? input.ledger : input.intent);
    vi.spyOn(rpc,"account").mockResolvedValue(input.payee);
    const where = { scope_hash: { scope: localScope, hash: plan.oldHash } };
    return { plan, input, rpc, localScope, where };
  }
  it("invalidates only after fresh proof, preserves packet/binding, skips retries and is idempotent",async()=>{
    const {plan,rpc,localScope,where}=await scenario();const guard=vi.fn();
    const result=await invalidateResetPacket(db,rpc,plan,guard);
    expect(result).toMatchObject({state:"INVALIDATED",finalized:false,events:[],keyResetProof:{resetTransactionHash:plan.resetHash}});
    const row=await db.nearTransaction.findUniqueOrThrow({where});
    expect(row.signedBase64).toBe("synthetic-packet-must-be-preserved");expect(row.keyNonce?.toFixed()).toBe("10");
    expect((await db.nearIntentRequest.findUniqueOrThrow({where:{scope_grantId_intentId:{scope:localScope,grantId:plan.args.grant_id,intentId:plan.args.intent_id}}})).txHash).toBe(plan.oldHash);
    const transactionReads=vi.mocked(rpc.transaction).mock.calls.length;
    expect(await invalidateResetPacket(db,rpc,plan,guard)).toEqual(result);
    expect(vi.mocked(rpc.transaction).mock.calls.length).toBe(transactionReads);
    const broadcast=vi.fn();const chain=new NearChain({contractId:plan.contract,executorId:plan.executor,rpcUrl:"https://rpc.testnet.near.org"},rpc,provider,db,broadcast);
    expect(await chain.resumePrepared(row)).toEqual(result);
    expect(await chain.track(plan.oldHash,plan.executor)).toEqual(result);
    expect(await new NearIndexer(chain,1).reconcileJournal()).toBe(0);
    expect(broadcast).not.toHaveBeenCalled();expect(vi.mocked(rpc.transaction).mock.calls.length).toBe(transactionReads);
    await expect(chain.store.commit(plan.oldHash,{transactionHash:plan.oldHash,finalized:true,state:"SETTLED",events:[]})).rejects.toThrow("contradictory");
    expect((await db.nearTransaction.findUniqueOrThrow({where})).state).toBe("INVALIDATED");expect(guard).toHaveBeenCalledTimes(3);
  });
  it.each(["unchanged nonce","RPC transport failure","old transaction exists","backend restarted","intent rebound","already settled"])("refuses %s without mutating journal",async kind=>{
    const {plan,input,rpc,localScope,where}=await scenario();const guard=vi.fn();
    if(kind==="unchanged nonce") (input.access as any).nonce="10";
    if(kind==="RPC transport failure") vi.mocked(rpc.transaction).mockImplementation(async hash=>{if(hash===plan.resetHash)return input.reset;throw new NearRpcError("TRANSPORT");});
    if(kind==="old transaction exists") vi.mocked(rpc.transaction).mockResolvedValue(input.reset);
    if(kind==="backend restarted") guard.mockImplementationOnce(()=>{}).mockImplementation(()=>{throw new Error("backend open");});
    if(kind==="intent rebound") await db.nearIntentRequest.update({where:{scope_grantId_intentId:{scope:localScope,grantId:plan.args.grant_id,intentId:plan.args.intent_id}},data:{txHash:"7".repeat(43)}});
    if(kind==="already settled") await db.nearTransaction.update({where,data:{state:"SETTLED"}});
    await expect(invalidateResetPacket(db,rpc,plan,guard)).rejects.toThrow();
    const row=await db.nearTransaction.findUniqueOrThrow({where});
    expect(row.state).toBe(kind==="already settled"?"SETTLED":"SUBMISSION_UNKNOWN");expect(row.observation).toBeNull();
    expect(row.signedBase64).toBe("synthetic-packet-must-be-preserved");
  });
});

describe("NEP-413 SDK crypto + Postgres session atomicity", () => {
  it("accepts explicitly issued callback-less CLI payload without changing wallet defaults", async () => {
    permission="FullAccess";const p=await proof(OWNER,"cli");
    expect(p.challenge.callbackUrl).toBeUndefined();expect(p.challenge.clientType).toBe("cli");expect(p.challenge.message).toContain("Client: cli");
    expect((await db.nearChallenge.findUniqueOrThrow({where:{id:p.challenge.challengeId}})).callbackUrl).toBe("");
    const session=await auth.verify(p.body);sessionIds.push(createHash("sha256").update(session.token).digest("hex"));
    expect((await auth.requireSession(`Bearer ${session.token}`)).accountId).toBe(OWNER);
  });
  it("never falls back between browser callback and CLI payload after failed verification", async () => {
    permission="FullAccess";
    for(const clientType of ["wallet","cli"] as const){
      const p=await proof(OWNER,clientType);
      const signed=await signer.signNep413Message(OWNER,{message:p.challenge.message,recipient:p.challenge.recipient,nonce:Buffer.from(p.challenge.nonce,"base64"),callbackUrl:clientType==="wallet"?undefined:"https://redline.test/near/auth/callback"});
      await expect(auth.verify({...p.body,signature:Buffer.from(signed.signature).toString("base64")})).rejects.toThrow();
      expect((await db.nearChallenge.findUniqueOrThrow({where:{id:p.challenge.challengeId}})).usedAt).toBeNull();
    }
  });
  it("issues a bound 32-byte challenge, authenticates and stores only token hash", async () => {
    permission = "FullAccess";
    const p = await proof(); expect(Buffer.from(p.challenge.nonce, "base64")).toHaveLength(32);
    expect(p.challenge.message).toContain("Network: testnet"); expect(p.challenge.message).toContain(OWNER);
    const session = await auth.verify(p.body);
    const tokenHash = createHash("sha256").update(session.token).digest("hex");sessionIds.push(tokenHash);
    const row = await db.nearSession.findUniqueOrThrow({ where: { tokenHash } });
    expect(row.accountId).toBe(OWNER);expect(row.tokenHash).not.toBe(session.token);
    expect((await auth.requireSession(`Bearer ${session.token}`)).accountId).toBe(OWNER);
  });
  it("allows exactly one winner for simultaneous verifies of the same signature", async () => {
    permission = "FullAccess";const p = await proof();
    const results = await Promise.allSettled([auth.verify(p.body), auth.verify(p.body)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    for (const result of results) if (result.status === "fulfilled") sessionIds.push(createHash("sha256").update(result.value.token).digest("hex"));
    await expect(auth.verify(p.body)).rejects.toThrow();
  });
  it("rejects wrong account, state, signature and a changed recipient/domain", async () => {
    permission = "FullAccess";const p = await proof();
    await expect(auth.verify({ ...p.body, accountId: "other.testnet" })).rejects.toThrow();
    await expect(auth.verify({ ...p.body, state: "x".repeat(43) })).rejects.toThrow();
    await expect(auth.verify({ ...p.body, signature: Buffer.alloc(64).toString("base64") })).rejects.toThrow();
    const other = new NearAuth(db, provider, "evil.test", "https://evil.test/callback");
    await expect(other.verify(p.body)).rejects.toThrow();
  });
  it("does not consume challenge on failed ownership or RPC verification", async () => {
    const p = await proof();permission = { FunctionCall: { allowance: "1", receiver_id: VAULT, method_names: ["execute_transfer"] } };
    await expect(auth.verify(p.body)).rejects.toThrow();
    expect((await db.nearChallenge.findUniqueOrThrow({ where: { id: p.challenge.challengeId } })).usedAt).toBeNull();
    permission = "FullAccess";
  });
  it("rejects expired challenge/session and rechecks revoked FullAccess permission", async () => {
    const p = await proof();now += 5 * 60_000;
    await expect(auth.verify(p.body)).rejects.toThrow();
    const session = await login();permission = { FunctionCall: {} };
    await expect(auth.requireSession(`Bearer ${session.token}`)).rejects.toThrow();
    permission = "FullAccess";now += 30 * 60_000;
    await expect(auth.requireSession(`Bearer ${session.token}`)).rejects.toThrow();
    now = Date.now();
  });
  it("invalidates a logged-out token", async () => {
    const session = await login();await auth.logout(`Bearer ${session.token}`);
    await expect(auth.requireSession(`Bearer ${session.token}`)).rejects.toThrow();
  });
  it("retains a valid session and returns unavailable on RPC rate limits rather than asserting bad identity",async()=>{
    const session=await login();
    access.mockRejectedValueOnce(new NearRpcError('RATE_LIMITED'));
    await expect(auth.requireSession(`Bearer ${session.token}`)).rejects.toMatchObject({statusCode:503});
    expect((await auth.requireSession(`Bearer ${session.token}`)).accountId).toBe(OWNER);
  });
});

describe("real Postgres receipt journal and numeric bounds", () => {
  it("commits events/checkpoint once under concurrent readers and after restart", async () => {
    const s = scope();const tx = fixture("safe-transfer");const store = new NearStore(db, s);
    await store.track(tx.transaction.hash, tx.transaction.signer_id);
    const rpc = { transaction: async () => tx };
    await Promise.all([new NearReceiptReader(VAULT, rpc, store).reconcile({ hash: tx.transaction.hash, signer: tx.transaction.signer_id }),
      new NearReceiptReader(VAULT, rpc, new NearStore(db, s)).reconcile({ hash: tx.transaction.hash, signer: tx.transaction.signer_id })]);
    expect(await new NearReceiptReader(VAULT, rpc, new NearStore(db, s)).reconcile({ hash: tx.transaction.hash, signer: tx.transaction.signer_id })).toBeNull();
    const events = await db.nearReceiptEvent.findMany({ where: { scope: s } });expect(events).toHaveLength(2);
    expect(new Set(events.map(e => e.id)).size).toBe(2);
  });
  it("rolls back event inserts when the checkpoint update fails", async () => {
    const s = scope();const store = new NearStore(db, s);const tx = fixture("safe-transfer");
    await store.track(tx.transaction.hash, tx.transaction.signer_id);
    // A real database constraint failure after createMany must roll back both writes.
    await db.$executeRawUnsafe(`ALTER TABLE "NearTransaction" ADD CONSTRAINT "it_checkpoint_fail" CHECK ("state" <> 'SETTLED') NOT VALID`);
    try {
      await expect(store.commit(tx.transaction.hash, observeVaultTransaction(tx, VAULT, tx.transaction.hash, tx.transaction.signer_id))).rejects.toThrow();
      expect(await db.nearReceiptEvent.count({ where: { scope: s } })).toBe(0);
      expect(await store.has(tx.transaction.hash)).toBe(false);
    } finally { await db.$executeRawUnsafe(`ALTER TABLE "NearTransaction" DROP CONSTRAINT "it_checkpoint_fail"`); }
  });
  it("stores u128/u64/u32 maxima exactly and prevents stale snapshot regression", async () => {
    const s = scope();const store = new NearStore(db, s);const raw = fixture("final-grant");const g = JSON.parse(Buffer.from(raw.result).toString());
    g.policy.spend_cap = g.finalized_spent = ((1n << 128n) - 1n).toString();g.next_nonce = ((1n << 64n) - 1n).toString();
    g.policy.max_transactions = g.finalized_transactions = 4294967295;
    await store.saveGrant("max", { value: g, blockHeight: 200, blockHash: raw.block_hash });
    const older = structuredClone(g);older.finalized_spent = "0";
    await store.saveGrant("max", { value: older, blockHeight: 199, blockHash: raw.block_hash });
    const row = await db.nearGrant.findUniqueOrThrow({ where: { scope_grantId: { scope: s, grantId: "max" } } });
    expect(row.spentYocto.toFixed(0)).toBe(g.finalized_spent);expect(row.nextNonce.toFixed(0)).toBe(g.next_nonce);
    expect(row.finalizedTransactions.toFixed(0)).toBe("4294967295");
  });
});

describe("scoped executor preparation and ambiguous transport", () => {
  it("rejects FullAccess, unlimited, wrong receiver, extra methods and excess allowance", () => {
    for (const p of ["FullAccess", { FunctionCall: { receiver_id: VAULT, method_names: [], allowance: "1" } },
      { FunctionCall: { receiver_id: "other.testnet", method_names: ["execute_transfer"], allowance: "1" } },
      { FunctionCall: { receiver_id: VAULT, method_names: ["execute_transfer", "withdraw"], allowance: "1" } },
      { FunctionCall: { receiver_id: VAULT, method_names: ["execute_transfer"], allowance: null } },
      { FunctionCall: { receiver_id: VAULT, method_names: ["execute_transfer"], allowance: "100000000000000000000001" } }]) expect(() => verifyExecutorPermission(p, VAULT)).toThrow();
  });
  it("persists the exact signed packet before broadcast and reuses it after timeout/restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "redline-near-it-"));const path = join(directory, "executor.json");
    const contract = `vault-${randomUUID().slice(0,8)}.testnet`;testScopes.push(`testnet:${contract}`);
    await writeFile(path, JSON.stringify({ account_id: AGENT, public_key: publicKey, private_key: key.toString() }), { mode: 0o600 });
    const rpc = new NearReadOnlyRpc();vi.spyOn(rpc, "connect").mockResolvedValue();
    const g = JSON.parse(Buffer.from(fixture("final-grant").result).toString());g.owner = OWNER;g.policy.executor = AGENT;
    vi.spyOn(rpc, "view").mockResolvedValue({ value: g, blockHeight: 100, blockHash: fixture("final-grant").block_hash });
    vi.spyOn(rpc, "transaction").mockRejectedValue(new Error("simulated unknown RPC result"));
    const args = { grant_id: "it-grant", intent_id: "same-intent", nonce: "1", asset: "NEAR", recipient: "nhat-redline-payee.testnet", amount: "1", policy_hash: g.policy.policy_hash };
    const packets: string[] = [];
    const broadcast = vi.fn(async (packet: string) => {
      packets.push(packet);
      const signed = SignedTransaction.decode(Buffer.from(packet, "base64"));
      const hash = baseEncode(createHash("sha256").update(signed.transaction.encode()).digest());
      const row = await db.nearTransaction.findUniqueOrThrow({ where: { scope_hash: { scope: `testnet:${contract}`, hash } } });
      expect(row.signedBase64).toBe(packet);expect(signed.transaction.receiverId).toBe(contract);expect(signed.transaction.nonce).toBe(6n);
      expect(signed.transaction.actions[0].functionCall?.gas).toBe(80_000_000_000_000n);
      throw new Error("simulated post-accept timeout");
    });
    permission = { FunctionCall: { receiver_id: contract, method_names: ["execute_transfer"], allowance: "100000000000000000000000" } };
    const config = { rpcUrl: "https://rpc.testnet.near.org", contractId: contract, executorId: AGENT, executorPublicKey: publicKey, credentialPath: path };
    try {
      const first = new NearChain(config, rpc, provider, db, broadcast);await first.connect();
      const a = await first.executeTransfer(OWNER, args);expect(a).toMatchObject({state:"UNKNOWN",phase:"SUBMISSION_UNCERTAIN",finalized:false});
      expect(a).toMatchObject({submissionError:"BROADCAST_UNAVAILABLE"});
      const diagnostic=await db.nearTransaction.findUniqueOrThrow({where:{scope_hash:{scope:`testnet:${contract}`,hash:a.transactionHash}}});
      expect(diagnostic.reason).toBe("BROADCAST_UNAVAILABLE");expect(diagnostic.state).toBe("SUBMISSION_UNKNOWN");
      const restarted = new NearChain(config, rpc, provider, db, broadcast);await restarted.connect();
      const b = await restarted.executeTransfer(OWNER, args);expect(b.transactionHash).toBe(a.transactionHash);
      expect(packets).toHaveLength(2);expect(packets[0]).toBe(packets[1]);
      const concurrent = await Promise.all([restarted.executeTransfer(OWNER,args),restarted.executeTransfer(OWNER,args)]);
      expect(concurrent.map(r=>r.transactionHash)).toEqual([a.transactionHash,a.transactionHash]);
      expect(new Set(packets).size).toBe(1);
      expect(await db.nearIntentRequest.count({where:{scope:`testnet:${contract}`}})).toBe(1);
      const persisted=await db.nearTransaction.findUniqueOrThrow({where:{scope_hash:{scope:`testnet:${contract}`,hash:a.transactionHash}}});
      await expect(restarted.resumePrepared({...persisted,argsJson:'{}'})).rejects.toThrow('identity mismatch');
      await expect(restarted.executeTransfer(OWNER, { ...args, amount: "2" })).rejects.toThrow("different arguments");
      await expect(restarted.executeTransfer(OWNER, { ...args, intent_id: "second" })).rejects.toThrow("unresolved");
    } finally { permission = "FullAccess";await unlink(path);await rmdir(directory); }
  });
  it("never reads a credential file when its public key has FullAccess", async () => {
    permission = "FullAccess";const rpc = new NearReadOnlyRpc();vi.spyOn(rpc,"connect").mockResolvedValue();
    const chain = new NearChain({ rpcUrl: "https://rpc.testnet.near.org", contractId: VAULT, executorId: AGENT, executorPublicKey: publicKey, credentialPath: "file-that-must-not-be-read" },rpc,provider,db);
    await expect(chain.connect()).rejects.toThrow();expect(chain.signingEnabled).toBe(false);
  });
});

describe("NEAR-only API routing/auth (real DB, SDK signatures; chain transport stubbed)", () => {
  it("never accepts an API-key or Solana-session fallback, and keeps wallet calls unsigned", async () => {
    permission = "FullAccess";
    const rpc = new NearReadOnlyRpc();const contract = `vault-${randomUUID().slice(0,8)}.testnet`;testScopes.push(`testnet:${contract}`);
    const chain = new NearChain({ rpcUrl: "https://rpc.testnet.near.org", contractId: contract, executorId: AGENT },rpc,provider,db);
    const app = await buildNearApp(chain, auth, "https://redline.test", false);
    try {
      expect((await app.inject({ method:"POST",url:"/near/owner-actions",headers:{"x-redline-key":"anything"},payload:{method:"deposit",amount:"1"} })).statusCode).toBe(401);
      expect((await app.inject({ method:"POST",url:"/near/auth/challenge",headers:{origin:"https://evil.test"},payload:{accountId:OWNER} })).statusCode).toBe(403);
      expect((await app.inject({ method:"POST",url:"/grants",payload:{} })).statusCode).toBe(404);
      const session = await login();const headers={authorization:`Bearer ${session.token}`};
      const response = await app.inject({method:"POST",url:"/near/owner-actions",headers,payload:{method:"deposit",amount:"500000000000000000000000"}});
      expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({unsigned:true,signerId:OWNER,network:"testnet"});
      expect(response.json().transaction.actions[0].params.deposit).toBe("500000000000000000000000");
      const draft=await prepareOwnerAction(chain,OWNER,{method:"create_grant",policy:{spend_cap:"200000000000000000000000",max_transactions:3,recipients:["payee.testnet"],expires_at_ns:((BigInt(Date.now())+3600000n)*1000000n).toString(),cooldown_ns:"0"}});
      const canonical=draft.canonicalPolicy!;expect(draft.transaction.actions[0].params.args.policy).toMatchObject({policy_hash:createHash("sha256").update(canonical).digest("hex"),executor:AGENT});
      permission={FunctionCall:{}};
      expect((await app.inject({method:"POST",url:"/near/owner-actions",headers,payload:{method:"deposit",amount:"1"}})).statusCode).toBe(401);
    } finally { permission="FullAccess";await app.close(); }
  });
  it("requires explicit Testnet and application origin", () => {
    expect(()=>nearConfig({})).toThrow();expect(()=>nearConfig({NEAR_APP_ORIGIN:"https://redline.test",NEAR_NETWORK:"mainnet"})).toThrow();
    expect(()=>nearConfig({NEAR_APP_ORIGIN:"https://redline.test/"})).toThrow();
    expect(nearConfig({NEAR_APP_ORIGIN:"http://localhost:5173"}).recipient).toBe("localhost:5173");
  });
});

describe("real DB block-discovery resume and dedupe (synthetic blocks, recorded receipt)",()=>{
  it("resumes across skipped heights and retries a failed block without duplicate events",async()=>{
    const contract=`vault-${randomUUID().slice(0,8)}.testnet`;const s=`testnet:${contract}`;testScopes.push(s);
    const rpc=new NearReadOnlyRpc();const chain=new NearChain({rpcUrl:'https://rpc.testnet.near.org',contractId:contract,executorId:AGENT},rpc,provider,db);
    const hash=(n:number)=>baseEncode(createHash('sha256').update('block-'+n).digest());
    const tx=fixture('cap-denial');tx.transaction.receiver_id=contract;
    for(const r of tx.receipts_outcome)if(r.outcome.executor_id===VAULT)r.outcome.executor_id=contract;
    vi.spyOn(rpc,'transaction').mockResolvedValue(tx);
    const raw=fixture('final-grant');vi.spyOn(rpc,'view').mockResolvedValue({value:JSON.parse(Buffer.from(raw.result).toString()),blockHeight:200,blockHash:raw.block_hash});
    let latest=102,fail=false;
    vi.spyOn(rpc,'finalBlock').mockImplementation(async height=>{
      if(height===101)throw new NearRpcError('REMOTE_ERROR','UNKNOWN_BLOCK');
      const h=height??latest;
      return {header:{height:h,hash:hash(h),prev_hash:hash(h===102?100:h-1)},chunks:h===100||h===103?[{chunk_hash:hash(999),height_included:h}]:[]};
    });
    vi.spyOn(rpc,'chunk').mockImplementation(async()=>{
      if(fail)throw new Error('simulated chunk timeout');
      return {transactions:[{hash:tx.transaction.hash,signer_id:tx.transaction.signer_id,receiver_id:contract}]};
    });
    expect(await new NearIndexer(chain,100).scan(1)).toBe(1);
    expect(await new NearIndexer(chain,100).scan(1)).toBe(1);
    expect((await db.nearWatermark.findUniqueOrThrow({where:{scope:s}})).height).toBe(102n);
    latest=103;fail=true;
    await expect(new NearIndexer(chain,100).scan(1)).rejects.toThrow('timeout');
    expect((await db.nearWatermark.findUniqueOrThrow({where:{scope:s}})).height).toBe(102n);
    fail=false;expect(await new NearIndexer(chain,100).scan(1)).toBe(1);
    expect(await db.nearReceiptEvent.count({where:{scope:s}})).toBe(1);
    expect((await db.nearGrant.findMany({where:{scope:s}}))[0].spentYocto.toFixed(0)).toBe('50000000000000000000000');
  });
});
