import assert from "node:assert/strict";
import { z } from "zod";
import { accountId, hashId, grantSchema, ledgerSchema, transferSchema, uint64, viewSchema } from "./types.js";
import { NearReadOnlyRpc, NearRpcError } from "./rpc.js";

export interface ResetPlan {
  executor: string; contract: string; owner: string; publicKey: string;
  oldHash: string; oldKeyNonce: string; resetHash: string;
  args: z.infer<typeof transferSchema>; policy: unknown;
  baselineLedger: z.infer<typeof ledgerSchema>; baselinePayee: string;
}
export interface ResetInputs {
  reset: unknown; blocks: unknown[]; access: unknown; signingAccess: unknown;
  grant: unknown; ledger: unknown; intent: unknown; payee: unknown;
  originalUnknown: boolean;
}
const accessSchema = z.object({ nonce: uint64, block_height: z.number().int().safe().nonnegative(), block_hash: hashId, permission: z.unknown() });
const outcomeSchema = z.object({ block_hash: hashId, outcome: z.object({ status: z.record(z.string(), z.unknown()) }) });

/** Fresh public reads. A transport failure is never treated as missing history. */
export async function collectKeyResetInputs(rpc: NearReadOnlyRpc, plan: ResetPlan): Promise<ResetInputs> {
  const reset = await rpc.transaction(plan.resetHash, plan.executor) as any;
  assert.equal(reset.final_execution_status, "FINAL", "Reset is not FINAL");
  const blocks = [];
  const hashes = new Set<string>([reset.transaction_outcome.block_hash, ...reset.receipts_outcome.map((r: any) => r.block_hash)]);
  for (const hash of hashes) blocks.push(await rpc.blockAtHash(hash));
  const access = await rpc.accessKey(plan.executor, plan.publicKey);
  const signingAccess = await rpc.accessKey(plan.executor, reset.transaction.public_key);
  let originalUnknown = false;
  try { await rpc.transaction(plan.oldHash, plan.executor, "NONE"); }
  catch (error) {
    if (error instanceof NearRpcError && error.code === "REMOTE_ERROR" && error.remoteName === "UNKNOWN_TRANSACTION") originalUnknown = true;
    else throw new Error("Original transaction lookup unavailable; no invalidation inferred");
  }
  const grant = await rpc.view(plan.contract, "get_grant", { grant_id: plan.args.grant_id });
  const ledger = await rpc.view(plan.contract, "get_owner_balance", { owner: plan.owner });
  const intent = await rpc.view(plan.contract, "get_intent", { grant_id: plan.args.grant_id, intent_id: plan.args.intent_id });
  const payee = await rpc.account(plan.args.recipient);
  return { reset, blocks, access, signingAccess, grant, ledger, intent, payee, originalUnknown };
}

/** Verify public FINAL reset proof and absence of financial effects. Never signs or changes DB. */
export function verifyKeyReset(plan: ResetPlan, input: ResetInputs) {
  accountId.parse(plan.executor); accountId.parse(plan.contract); accountId.parse(plan.owner);
  hashId.parse(plan.oldHash); hashId.parse(plan.resetHash); uint64.parse(plan.oldKeyNonce);
  const args = transferSchema.parse(plan.args);
  const reset = z.object({
    final_execution_status: z.literal("FINAL"), status: z.object({ SuccessValue: z.string() }).strict(),
    transaction: z.object({ hash: hashId, signer_id: accountId, receiver_id: accountId, public_key: z.string(), actions: z.array(z.unknown()).length(2) }),
    transaction_outcome: outcomeSchema, receipts_outcome: z.array(outcomeSchema).min(1),
  }).parse(input.reset);
  assert.equal(reset.transaction.hash, plan.resetHash, "Reset hash mismatch");
  assert.equal(reset.transaction.signer_id, plan.executor, "Reset signer mismatch");
  assert.equal(reset.transaction.receiver_id, plan.executor, "Reset receiver mismatch");
  assert.notEqual(reset.transaction.public_key, plan.publicKey, "Reset must use separate FullAccess signer");
  const permission = { FunctionCall: { receiver_id: plan.contract, method_names: ["execute_transfer"], allowance: "100000000000000000000000" } };
  assert.deepEqual(reset.transaction.actions[0], { DeleteKey: { public_key: plan.publicKey } }, "Unexpected reset first action");
  const add = z.object({ AddKey: z.object({ public_key: z.string(), access_key: z.object({ nonce: z.union([z.literal(0), z.literal("0")]), permission: z.unknown() }).strict() }).strict() }).strict().parse(reset.transaction.actions[1]);
  assert.equal(add.AddKey.public_key, plan.publicKey, "Reset added different key");
  assert.deepEqual(add.AddKey.access_key.permission, permission, "Reset changed scope/allowance");
  const outcomes = [reset.transaction_outcome, ...reset.receipts_outcome];
  for (const item of outcomes) assert(Object.keys(item.outcome.status).length === 1 &&
    ["SuccessValue", "SuccessReceiptId"].includes(Object.keys(item.outcome.status)[0]), "Reset receipt not successful");
  const headers = input.blocks.map(value => z.object({ header: z.object({ hash: hashId, height: z.number().int().nonnegative().safe() }) }).parse(value).header);
  const heights = outcomes.map(item => {
    const found = headers.filter(h => h.hash === item.block_hash);
    assert.equal(found.length, 1, "Reset execution block missing or ambiguous"); return found[0].height;
  });
  const resetHeight = Math.max(...heights);
  const access = accessSchema.parse(input.access), signingAccess = accessSchema.parse(input.signingAccess);
  assert.deepEqual(access.permission, permission, "Current key scope/allowance mismatch");
  assert.equal(signingAccess.permission, "FullAccess", "Reset signing key is not FullAccess");
  assert(access.block_height >= resetHeight && signingAccess.block_height >= resetHeight, "Access snapshot precedes reset execution");
  assert(BigInt(access.nonce) > BigInt(plan.oldKeyNonce), "Reset nonce does not invalidate old packet");
  assert.equal(input.originalUnknown, true, "Original transaction must be explicitly unknown, not unavailable");
  const grant = viewSchema(grantSchema).parse(input.grant);
  const ledger = viewSchema(ledgerSchema).parse(input.ledger);
  const intent = viewSchema(z.null()).parse(input.intent);
  const payee = z.object({ amount: z.string().regex(/^\d+$/), block_height: z.number().int().safe().nonnegative(), block_hash: hashId }).parse(input.payee);
  for (const height of [grant.blockHeight, ledger.blockHeight, intent.blockHeight, payee.block_height]) assert(height >= resetHeight, "Financial snapshot precedes key reset");
  assert.equal(grant.value.owner, plan.owner); assert.equal(grant.value.policy.executor, plan.executor);
  assert.deepEqual(grant.value.policy, plan.policy, "Reviewed grant policy changed");
  assert.equal(grant.value.policy.policy_hash, args.policy_hash);
  assert.equal(grant.value.next_nonce, args.nonce, "Grant nonce advanced");
  assert.equal(grant.value.finalized_spent, "0"); assert.equal(grant.value.pending_reserved, "0");
  assert.equal(grant.value.finalized_transactions, 0); assert.equal(grant.value.pending_transactions, 0);
  const baseline = ledgerSchema.parse(plan.baselineLedger);
  for (const field of ["credited", "finalized_spent", "completed_withdrawals", "pending_reserved", "pending_withdrawals"] as const)
    assert.equal(ledger.value[field], baseline[field], "Owner financial ledger changed");
  assert.equal(ledger.value.pending_reserved, "0"); assert.equal(ledger.value.pending_withdrawals, "0");
  assert.equal(payee.amount, plan.baselinePayee, "Payee balance changed; reconcile before recovery");
  return {
    status: "VERIFIED_KEY_RESET_ONLY" as const, network: "testnet", executor: plan.executor, contract: plan.contract,
    publicKey: plan.publicKey, oldTransactionHash: plan.oldHash, oldKeyNonce: plan.oldKeyNonce,
    resetTransactionHash: plan.resetHash, resetExecutionHeight: resetHeight, finalizedKeyNonce: access.nonce,
    grantId: args.grant_id, intentId: args.intent_id, grantExpiredAtVerification: BigInt(grant.value.policy.expires_at_ns) <= BigInt(Date.now()) * 1000000n,
    originalIntentAbsent: true, financialBaselinesUnchanged: true,
    journalChanged: false, replacementSigned: false,
    limitation: "Collected FINAL public RPC consistency checks, not light-client proof. Old packet cannot pass current nonce; journal retirement/replacement requires a separate guarded step.",
  };
}
