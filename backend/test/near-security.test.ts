import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { NearReadOnlyRpc, parseRpcJson } from "../src/near/rpc.js";
import { FinalAccessProvider } from "../src/near/auth.js";
import { observeVaultTransaction } from "../src/near/receipts.js";
import { broadcastPrepared } from "../src/near/broadcast.js";
import { grantSchema } from "../src/near/types.js";
import { prepareExecutor } from "../scripts/prepare-near-executor.js";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cliLoginProof } from "../src/near/cli-login.js";
import { KeyPair, KeyPairSigner, baseEncode } from "near-api-js";
import { networkBudget, RequestBudget, retryAfterMs } from "../src/near/rpc-budget.js";

const fixture = (n: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/phase2-${n}.json`, import.meta.url), "utf8")).result;

describe("shared RPC throttling, fake clock only (never load tests public endpoints)",()=>{
  it("spaces simultaneous reservations and shares endpoint budgets between clients",async()=>{
    let clock=0;const waits:number[]=[];const starts:number[]=[];
    const budget=new RequestBudget(2000,()=>clock,async ms=>{waits.push(ms);clock+=ms;});
    await Promise.all([1,2,3].map(async()=>{await budget.beforeRequest();starts.push(clock);}));
    expect(waits).toEqual([2000,2000]);expect(clock).toBe(4000);
    expect(networkBudget('https://test.rpc.fastnear.com',fetch)).toBe(networkBudget('https://test.rpc.fastnear.com/',fetch));
  });
  it("extends an existing shared cooldown and parses bounded Retry-After",async()=>{
    let clock=0;const budget=new RequestBudget(2000,()=>clock,async ms=>{clock+=ms;});
    budget.coolDown(30000);budget.coolDown(1000);await budget.beforeRequest();expect(clock).toBe(30000);
    expect(retryAfterMs('60',0)).toBe(60000);expect(retryAfterMs(null,0)).toBe(30000);
    expect(retryAfterMs(new Date(90000).toUTCString(),0)).toBe(90000);
  });
  it("sets cooldown after one HTTP429 without immediate replay",async()=>{
    const budget={beforeRequest:vi.fn(async()=>{}),coolDown:vi.fn()};
    const fake=vi.fn(async()=>new Response('',{status:429,headers:{'retry-after':'45'}})) as unknown as typeof fetch;
    const rpc=new NearReadOnlyRpc('https://test.rpc.fastnear.com',fake,async()=>{},budget);
    await expect(rpc.connect()).rejects.toThrow('RATE_LIMITED');expect(fake).toHaveBeenCalledTimes(1);expect(budget.coolDown).toHaveBeenCalledWith(45000);
  });
});

describe("CLI 0.30.1 signature normalization, ephemeral SDK key only",()=>{
  it("converts CLI ed25519:base58 to the API's exact 64-byte base64 signature",async()=>{
    const signer=new KeyPairSigner(KeyPair.fromRandom("ed25519"));
    const signed=await signer.signNep413Message("owner.testnet",{message:"test",nonce:new Uint8Array(32),recipient:"localhost:5173"});
    const challenge={accountId:"owner.testnet",challengeId:"challenge",state:"state"};
    const stdout=JSON.stringify({accountId:challenge.accountId,publicKey:signed.publicKey.toString(),signature:"ed25519:"+baseEncode(signed.signature)});
    expect(cliLoginProof(stdout,challenge)).toEqual({...challenge,publicKey:signed.publicKey.toString(),signature:Buffer.from(signed.signature).toString("base64")});
    expect(()=>cliLoginProof(stdout,{...challenge,accountId:"stranger.testnet"})).toThrow("different account");
  });
  it("rejects wrong signature length instead of guessing an encoding",()=>{
    const key=KeyPair.fromRandom("ed25519");
    expect(()=>cliLoginProof(JSON.stringify({accountId:"owner.testnet",publicKey:key.getPublicKey().toString(),signature:"ed25519:1111"}),{accountId:"owner.testnet",challengeId:"x",state:"s"})).toThrow("length");
  });
});

describe("finalized key ownership transport and exact nonce", () => {
  it("preserves a JSON u64 nonce at maximum, before IEEE-754 rounding", () => {
    expect(parseRpcJson('{"nonce":18446744073709551615,"block_height":42}')).toEqual({ nonce: "18446744073709551615", block_height: 42 });
    expect(parseRpcJson('{"nonce":9007199254740993}')).toEqual({ nonce: "9007199254740993" });
  });
  it("forces finalized key queries even when caller requested optimistic", async () => {
    const calls: Record<string, unknown>[] = [];
    const fake = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body=JSON.parse(String(init?.body));calls.push(body);
      if(body.method==='status') return Response.json({jsonrpc:'2.0',id:body.id,result:{chain_id:'testnet',sync_info:{syncing:false}}});
      return new Response('{"jsonrpc":"2.0","id":"'+body.id+'","result":{"nonce":18446744073709551615,"permission":"FullAccess","block_height":42,"block_hash":"'+fixture('final-grant').block_hash+'"}}');
    }) as unknown as typeof fetch;
    const rpc=new NearReadOnlyRpc(undefined,fake);
    const provider=new FinalAccessProvider({url:'https://rpc.testnet.near.org'},rpc);
    const key=await provider.viewAccessKey({accountId:'owner.testnet',publicKey:'ed25519:public',finalityQuery:{finality:'optimistic'}});
    expect(key.nonce).toBe((1n<<64n)-1n);
    expect(calls[1].params).toMatchObject({request_type:'view_access_key',finality:'final',account_id:'owner.testnet'});
  });
});

describe("owner receipt observations from recorded public Testnet data", () => {
  it.each([['owner-storage','CONFIRMED'],['agent-storage','CONFIRMED'],['owner-deposit','CONFIRMED'],['grant-created','CONFIRMED'],['revoke','CONFIRMED'],['withdraw','SETTLED']])('%s -> %s',(name,state)=>{
    const tx=fixture(name);expect(observeVaultTransaction(tx,'nhat-redline-vault.testnet',tx.transaction.hash,tx.transaction.signer_id).state).toBe(state);
  });
  it("refuses a withdrawal callback attributed to another owner",()=>{
    const tx=fixture('withdraw');
    for(const r of tx.receipts_outcome) r.outcome.logs=r.outcome.logs.map((s:string)=>s.replaceAll('nhat-redline-owner.testnet','stranger.testnet'));
    expect(observeVaultTransaction(tx,'nhat-redline-vault.testnet',tx.transaction.hash,tx.transaction.signer_id).state).toBe('UNKNOWN');
  });
  it("rejects inconsistent grant reservation data",()=>{
    const g=JSON.parse(Buffer.from(fixture('final-grant').result).toString());
    g.pending_reserved=g.policy.spend_cap;expect(()=>grantSchema.parse(g)).toThrow();
  });
});

describe("bounded persisted-packet broadcast transport (mock fetch, no chain submission)",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("sends the supplied packet once with INCLUDED and no redirect",async()=>{
    const fake=vi.fn(async(_url:unknown,init?:RequestInit)=>{
      expect(JSON.parse(String(init?.body))).toMatchObject({method:'send_tx',params:{signed_tx_base64:'test-packet',wait_until:'INCLUDED'}});
      expect(init?.redirect).toBe('error');expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({jsonrpc:'2.0',id:'redline-prepared',result:{final_execution_status:'INCLUDED'}});
    });vi.stubGlobal('fetch',fake);
    await broadcastPrepared('https://rpc.testnet.near.org','test-packet');expect(fake).toHaveBeenCalledTimes(1);
  });
  it("leaves rejected or mismatched responses uncertain",async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'wrong',result:{}})));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toThrow();
  });
  it("reports HTTP status without leaking response text or retrying",async()=>{
    const fake=vi.fn(async()=>new Response('sensitive upstream diagnostic',{status:403}));vi.stubGlobal('fetch',fake);
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toMatchObject({code:'HTTP_403',message:'NEAR submission unavailable: HTTP_403'});
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it("whitelists RPC rejection categories and strips arbitrary error payloads",async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'redline-prepared',error:{cause:{name:'INVALID_TRANSACTION',info:'private upstream data'}}})));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toMatchObject({code:'INVALID_TRANSACTION',message:'NEAR submission unavailable: INVALID_TRANSACTION'});
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'redline-prepared',error:{cause:{name:'DO_NOT_REFLECT_THIS_SECRET'}}})));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toMatchObject({code:'RPC_REJECTED'});
  });
  it("categorizes malformed responses and transport uncertainty without raw errors",async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('bad upstream body')));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toMatchObject({code:'INVALID_RESPONSE'});
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('secret URL in transport error');}));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toMatchObject({code:'TRANSPORT_OR_TIMEOUT',message:'NEAR submission unavailable: TRANSPORT_OR_TIMEOUT'});
  });
  it.each([
    ['InvalidSignature','InvalidSignature'],
    ['Expired','Expired'],
    [{InvalidNonce:{ak_nonce:99,tx_nonce:1}},'InvalidNonce'],
    [{InvalidAccessKeyError:{NotEnoughAllowance:{allowance:'0',secret:'never reflect'}}},'NotEnoughAllowance'],
    [{InvalidAccessKeyError:{ReceiverMismatch:{ak_receiver:'private',tx_receiver:'private'}}},'ReceiverMismatch'],
    [{UnexpectedSecret:'do not reflect'},undefined],
  ])("extracts only whitelisted invalid transaction category %#",async(invalid,category)=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'redline-prepared',error:{cause:{name:'INVALID_TRANSACTION'},data:{TxExecutionError:{InvalidTxError:invalid}}}})));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toMatchObject({code:category?`INVALID_TRANSACTION:${category}`:'INVALID_TRANSACTION'});
  });
});

describe('local executor candidate helper (temporary test directory only)',()=>{
  it('never overwrites a generated key on retry and returns only public metadata',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'redline-near-key-test-'));
    try{
      const first=await prepareExecutor(directory);const before=await readFile(first.credentialPath,'utf8');
      const again=await prepareExecutor(directory);
      expect(again).toEqual(first);expect(await readFile(first.credentialPath,'utf8')).toBe(before);
      expect(first).not.toHaveProperty('private_key');expect(first.publicKey.startsWith('ed25519:')).toBe(true);
      expect(JSON.parse(before)).toMatchObject({account_id:first.accountId,public_key:first.publicKey});
    }finally{await unlink(join(directory,'public.json'));await unlink(join(directory,'executor.json'));await rmdir(directory);}
  });
});
