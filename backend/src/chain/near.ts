import { readFile } from "node:fs/promises";
import { KeyPairSigner, PublicKey, SignedTransaction, actions, baseDecode, baseEncode, createTransaction } from "near-api-js";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient, type NearTransaction } from "@prisma/client";
import { z } from "zod";
import { FinalAccessProvider } from "../near/auth.js";
import { NearReadOnlyRpc } from "../near/rpc.js";
import { NearStore, terminalStates } from "../near/store.js";
import { NearReceiptReader } from "../near/reader.js";
import { accountId, grantSchema, httpError, ledgerSchema, transferSchema, viewSchema, type TransferArgs } from "../near/types.js";
import { u64, U64_MAX } from "../near/units.js";
import { broadcastPrepared, NearBroadcastError } from "../near/broadcast.js";

export interface NearConfig { rpcUrl: string; contractId: string; executorId: string; executorPublicKey?: string; credentialPath?: string }
const allowanceMax = 100000000000000000000000n; // 0.1 NEAR, gas allowance only

export function verifyExecutorPermission(permission: unknown, contract: string): void {
  const key = z.object({ FunctionCall: z.object({ receiver_id: z.literal(contract), method_names: z.tuple([z.literal("execute_transfer")]), allowance: z.string() }).strict() }).strict().parse(permission);
  const allowance = BigInt(key.FunctionCall.allowance);
  if (allowance <= 0n || allowance > allowanceMax) throw new Error("Executor gas allowance must be positive and at most 0.1 NEAR");
}

/** NEAR-native result model. Deliberately never routes through Solana's boolean-success runtime. */
export class NearChain {
  readonly kind = "near" as const;
  readonly network = "testnet" as const;
  readonly store: NearStore;
  private signer?: KeyPairSigner;
  readonly reader: NearReceiptReader;

  constructor(readonly config: NearConfig, readonly rpc: NearReadOnlyRpc, readonly provider: FinalAccessProvider, readonly db: PrismaClient,
    private readonly broadcast: (packet: string) => Promise<void> = packet => broadcastPrepared(config.rpcUrl, packet)) {
    accountId.parse(config.contractId); accountId.parse(config.executorId);
    this.store = new NearStore(db, `testnet:${config.contractId}`);
    this.reader = new NearReceiptReader(config.contractId, rpc, this.store);
  }

  async connect(): Promise<void> {
    await this.rpc.connect();
    if (!this.config.credentialPath && !this.config.executorPublicKey) return;
    if (!this.config.credentialPath || !this.config.executorPublicKey?.startsWith("ed25519:")) throw new Error("Executor credential and public key must both be configured");
    // Validate the PUBLIC on-chain permission before reading any credential file.
    const access = await this.provider.viewAccessKey({ accountId: this.config.executorId, publicKey: this.config.executorPublicKey, finalityQuery: { finality: "final" } });
    verifyExecutorPermission(access.permission, this.config.contractId);
    try {
      const file = z.object({ account_id: z.literal(this.config.executorId), public_key: z.literal(this.config.executorPublicKey), private_key: z.string().startsWith("ed25519:") }).strict()
        .parse(JSON.parse(await readFile(this.config.credentialPath, "utf8")));
      this.signer = KeyPairSigner.fromSecretKey(file.private_key as `ed25519:${string}`);
      if ((await this.signer.getPublicKey()).toString() !== file.public_key) throw new Error("Key mismatch");
    } catch { this.signer = undefined; throw new Error("NEAR executor credential could not be loaded or verified"); }
  }

  get signingEnabled(): boolean { return Boolean(this.signer); }

  async readGrant(grantId: string) {
    const raw = await this.rpc.view(this.config.contractId, "get_grant", { grant_id: grantId });
    const view = viewSchema(grantSchema.nullable()).parse(raw);
    if (!view.value) return null;
    await this.store.saveGrant(grantId, raw);
    return { ...view, value: view.value };
  }

  async readBalance(owner: string) {
    accountId.parse(owner);
    return viewSchema(ledgerSchema).parse(await this.rpc.view(this.config.contractId, "get_owner_balance", { owner }));
  }

  async track(hash: string, signerId: string) {
    await this.store.track(hash, signerId);
    const observation = await this.reader.reconcile({ hash, signer: signerId });
    if (observation) return observation;
    return JSON.parse((await this.db.nearTransaction.findUniqueOrThrow({ where: { scope_hash: { scope: this.store.scope, hash } } })).observation!);
  }

  async executeTransfer(owner: string, input: unknown) {
    const args = transferSchema.parse(input);
    if (!this.signer || !this.config.executorPublicKey) throw httpError(503, "Scoped NEAR executor key is not configured; no transaction submitted");
    const signer = this.signer;
    const keyPublic = this.config.executorPublicKey;
    const argsJson = JSON.stringify(args);
    const prepared = await this.db.$transaction(async tx => {
      // Across processes too: serialize key nonce allocation and unresolved submissions.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.store.scope + ":executor:" + this.config.executorId}, 0))`;
      const id = { scope: this.store.scope, grantId: args.grant_id, intentId: args.intent_id };
      const existing = await tx.nearIntentRequest.findUnique({ where: { scope_grantId_intentId: id } });
      if (existing) {
        if (existing.ownerId !== owner || existing.argsJson !== argsJson) throw httpError(409, "Intent ID already binds different arguments");
        return tx.nearTransaction.findUniqueOrThrow({ where: { scope_hash: { scope: this.store.scope, hash: existing.txHash } } });
      }
      const unresolved = await tx.nearTransaction.findFirst({ where: { scope: this.store.scope, signerId: this.config.executorId, keyPublic: { not: null }, state: { notIn: terminalStates } } });
      if (unresolved) throw httpError(409, "Previous executor transaction is unresolved; reconcile it before preparing another intent");
      const snapshot = viewSchema(grantSchema.nullable()).parse(await this.rpc.view(this.config.contractId, "get_grant", { grant_id: args.grant_id }));
      if (!snapshot.value || snapshot.value.owner !== owner || snapshot.value.policy.executor !== this.config.executorId) throw httpError(403, "Grant owner/executor mismatch");
      if (snapshot.value.policy.policy_hash !== args.policy_hash) throw httpError(409, "Policy hash differs from on-chain grant");
      // Policy decisions (including intentional denials) remain the contract's job.
      const access = await this.provider.viewAccessKey({ accountId: this.config.executorId, publicKey: keyPublic, finalityQuery: { finality: "final" } });
      verifyExecutorPermission(access.permission, this.config.contractId);
      const last = await tx.nearTransaction.findFirst({ where: { scope: this.store.scope, signerId: this.config.executorId, keyPublic }, orderBy: { keyNonce: "desc" } });
      const persisted = last?.keyNonce ? BigInt(last.keyNonce.toFixed(0)) : 0n;
      const nonce = (access.nonce > persisted ? access.nonce : persisted) + 1n;
      if (nonce > U64_MAX) throw new Error("Executor nonce overflow");
      const signed = await signer.signTransaction(createTransaction(this.config.executorId, PublicKey.fromString(keyPublic), this.config.contractId,
        nonce, [actions.functionCall("execute_transfer", args, 100_000_000_000_000n, 0n)], baseDecode(access.block_hash)));
      const hash = baseEncode(signed.txHash);
      const row = await tx.nearTransaction.create({ data: { scope: this.store.scope, hash, signerId: this.config.executorId, ownerId: owner, grantId: args.grant_id,
        intentId: args.intent_id, argsJson, signedBase64: Buffer.from(signed.signedTransaction.encode()).toString("base64"), keyPublic,
        keyNonce: new Prisma.Decimal(u64(nonce.toString()).toString()), state: "PREPARED" } });
      await tx.nearIntentRequest.create({ data: { ...id, ownerId: owner, argsJson, txHash: hash } });
      return row; // committed before any broadcast
    }, { timeout: 60_000 });
    if (terminalStates.includes(prepared.state)) return JSON.parse(prepared.observation!);
    return this.resumePrepared(prepared);
  }

  async resumePrepared(prepared: NearTransaction) {
    if (terminalStates.includes(prepared.state)) return JSON.parse(prepared.observation!);
    if (!prepared.signedBase64 || !this.signingEnabled) return this.track(prepared.hash, prepared.signerId);
    // Validate persisted packet identity and exact scope before every retry/restart.
    const signed = SignedTransaction.decode(Buffer.from(prepared.signedBase64, "base64"));
    const tx = signed.transaction;
    const digest = createHash("sha256").update(tx.encode()).digest();
    const call = tx.actions[0]?.functionCall;
    if (prepared.scope !== this.store.scope || baseEncode(digest) !== prepared.hash || tx.signerId !== this.config.executorId || tx.receiverId !== this.config.contractId ||
        tx.publicKey.toString() !== this.config.executorPublicKey || tx.actions.length !== 1 || !call || call.methodName !== "execute_transfer" || call.deposit !== 0n ||
        call.gas !== 100_000_000_000_000n || !signed.signature.ed25519Signature || !PublicKey.fromString(tx.publicKey.toString()).verify(digest, Uint8Array.from(signed.signature.ed25519Signature.data)) ||
        JSON.stringify(transferSchema.parse(JSON.parse(Buffer.from(call.args).toString("utf8")))) !== prepared.argsJson) throw new Error("Persisted executor packet identity mismatch");
    try {
      const current = await this.track(prepared.hash, this.config.executorId);
      if (current.finalized && terminalStates.includes(current.state)) return current;
    } catch { /* A missing/uncertain tx is not authorization to create a new one. */ }
    const access = await this.provider.viewAccessKey({ accountId: this.config.executorId, publicKey: this.config.executorPublicKey!, finalityQuery: { finality: "final" } });
    verifyExecutorPermission(access.permission, this.config.contractId);
    // Never re-sign or replace the intent, even if its block hash has expired.
    let submissionError: string | undefined;
    try {
      await this.broadcast(prepared.signedBase64);
      await this.db.nearTransaction.updateMany({ where: { scope: this.store.scope, hash: prepared.hash, state: { in: ["PREPARED", "SUBMISSION_UNKNOWN"] } }, data: { state: "SUBMITTED", reason: null } });
    } catch (error) {
      submissionError = error instanceof NearBroadcastError ? error.code : "BROADCAST_UNAVAILABLE";
      await this.db.nearTransaction.updateMany({ where: { scope: this.store.scope, hash: prepared.hash, state: { in: ["PREPARED", "SUBMISSION_UNKNOWN"] } }, data: { state: "SUBMISSION_UNKNOWN", reason: submissionError } });
    }
    try { return await this.track(prepared.hash, this.config.executorId); }
    catch { return { transactionHash: prepared.hash, finalized: false, state: "UNKNOWN", phase: "SUBMISSION_UNCERTAIN", submissionError, events: [], needsReconciliation: true }; }
  }
}
