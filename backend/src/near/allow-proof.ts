import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { decodeBase64Json, observeVaultTransaction } from "./receipts.js";
import { grantSchema, ledgerSchema, transferSchema } from "./types.js";
export const PROOF_VAULT = "nhat-redline-vault.testnet", PROOF_AGENT = "nhat-redline-agent.testnet", PROOF_OWNER = "nhat-redline-owner.testnet", PROOF_PAYEE = "nhat-redline-payee.testnet";
export const PROOF_KEY = "ed25519:9hauPZp4YBAHNMNp8bf4ThyYuSMeVTrKn5twEU2JrCy3";
// This checks saved public RPC data, not a cryptographic light-client proof.
export function verifyAllowProof(before: any, after: any) {
  assert.equal(before.network, "testnet"); assert.equal(after.network, "testnet");
  const args = transferSchema.parse(before.request);
  assert(isDeepStrictEqual(args, after.request), "Request identity changed");
  assert.equal(args.amount, "10000000000000000000000"); assert.equal(args.recipient, PROOF_PAYEE);
  const tx = after.transaction;
  assert.equal(tx.transaction.public_key, PROOF_KEY);
  const observed = observeVaultTransaction(tx, PROOF_VAULT, tx.transaction.hash, PROOF_AGENT);
  assert.equal(observed.finalized, true); assert.equal(observed.state, "SETTLED"); assert.equal(observed.reason, "OK");
  assert.equal(tx.transaction.actions.length, 1);
  const action = tx.transaction.actions[0].FunctionCall;
  assert.equal(action.method_name, "execute_transfer"); assert.equal(action.deposit, "0"); assert.equal(BigInt(action.gas), 80000000000000n);
  assert(isDeepStrictEqual(decodeBase64Json(action.args), args), "Transaction arguments differ from reviewed request");
  const expected = { nonce: args.nonce, recipient: args.recipient, amount: args.amount, status: "SETTLED", reason: "OK" };
  assert.equal(before.intent.value, null, "Before snapshot already contained this intent");
  assert(isDeepStrictEqual(after.intent.value, expected), "Stored intent/callback mismatch");
  assert(isDeepStrictEqual(decodeBase64Json(tx.status.SuccessValue), expected));
  assert(observed.events.some(e => e.event === "intent_pending")); assert(observed.events.some(e => e.event === "intent_completed"));
  assert(tx.receipts_outcome.some((r: any) => r.outcome.executor_id === PROOF_PAYEE && typeof r.outcome.status === "object" && "SuccessValue" in r.outcome.status), "Missing successful payee receipt");
  for (const r of [tx.transaction_outcome, ...tx.receipts_outcome]) assert(typeof r.outcome.status === "object" && !("Failure" in r.outcome.status));
  const g0 = grantSchema.parse(before.grant.value), g1 = grantSchema.parse(after.grant.value);
  assert.equal(g0.owner, PROOF_OWNER); assert.equal(g1.owner, PROOF_OWNER); assert(g0.active);
  assert(isDeepStrictEqual(g0.policy, g1.policy)); assert.equal(g0.policy.policy_hash, args.policy_hash); assert.equal(g0.policy.executor, PROOF_AGENT);
  assert.equal(g0.policy.spend_cap, "50000000000000000000000"); assert.equal(g0.policy.max_transactions, 3); assert.deepEqual(g0.policy.recipients, [PROOF_PAYEE]);
  assert.equal(g0.next_nonce, args.nonce); assert.equal(BigInt(g1.next_nonce), BigInt(args.nonce) + 1n);
  assert.equal(BigInt(g1.finalized_spent) - BigInt(g0.finalized_spent), BigInt(args.amount));
  assert.equal(g1.finalized_transactions, g0.finalized_transactions + 1);
  for (const g of [g0, g1]) { assert.equal(g.pending_reserved, "0"); assert.equal(g.pending_transactions, 0); }
  const l0 = ledgerSchema.parse(before.owner.value), l1 = ledgerSchema.parse(after.owner.value);
  assert.equal(BigInt(l1.finalized_spent) - BigInt(l0.finalized_spent), BigInt(args.amount));
  for (const k of ["credited", "completed_withdrawals", "pending_reserved", "pending_withdrawals"] as const) assert.equal(l0[k], l1[k]);
  assert.equal(l1.pending_reserved, "0"); assert.equal(l1.pending_withdrawals, "0");
  assert.equal(BigInt(after.payee.amount) - BigInt(before.payee.amount), BigInt(args.amount), "Payee delta ambiguous or incorrect");
  for (const snapshot of [before, after]) { const p = snapshot.key.permission.FunctionCall; assert.equal(p.receiver_id, PROOF_VAULT); assert.deepEqual(p.method_names, ["execute_transfer"]); assert(BigInt(p.allowance) > 0n && BigInt(p.allowance) <= 100000000000000000000000n); }
  assert(BigInt(after.key.nonce) >= BigInt(tx.transaction.nonce)); assert(BigInt(tx.transaction.nonce) > BigInt(before.key.nonce));
  const latest = Math.max(...tx.receipts_outcome.map((r: any) => after.blocks[r.block_hash].header.height));
  const pending = observed.events.find(e => e.event === "intent_pending")!;
  const dispatched = tx.receipts_outcome.find((r: any) => r.id === pending.receiptId);
  assert(BigInt(after.blocks[dispatched.block_hash].header.timestamp_nanosec) < BigInt(g0.policy.expires_at_ns), "Dispatch after grant expiry");
  for (const view of [after.grant, after.intent, after.owner, after.key, after.payee]) assert((view.blockHeight ?? view.block_height) >= latest, "Snapshot predates callback");
  return { status: "PASS_FINAL_SCOPED_ALLOW", transactionHash: tx.transaction.hash, grantId: args.grant_id, intentId: args.intent_id, amountYocto: args.amount, callback: "SETTLED", key: PROOF_KEY, finalized: true, scope: "Saved RPC consistency checks; separately match the API response hash to establish API linkage. Balance delta requires no unrelated payee activity in capture interval. Not a light-client proof or browser E2E." };
}
