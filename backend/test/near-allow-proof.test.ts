import { describe, expect, it } from "vitest";
import { PROOF_AGENT, PROOF_KEY, PROOF_OWNER, PROOF_PAYEE, PROOF_VAULT, verifyAllowProof } from "../src/near/allow-proof.js";
// Entirely synthetic verifier test vectors. Never saved as Testnet evidence.
function vector() {
  const amount = "10000000000000000000000", hash = "a".repeat(44);
  const request = { grant_id: "grant-test", intent_id: "intent-test", nonce: "0", asset: "NEAR", recipient: PROOF_PAYEE, amount, policy_hash: "a".repeat(64) };
  const policy = { executor: PROOF_AGENT, policy_hash: request.policy_hash, spend_cap: "50000000000000000000000", max_transactions: 3, recipients: [PROOF_PAYEE], expires_at_ns: "1793738771164000000", cooldown_ns: "0" };
  const grant = { owner: PROOF_OWNER, active: true, next_nonce: "0", finalized_spent: "0", pending_reserved: "0", finalized_transactions: 0, pending_transactions: 0, has_reserved: false, last_reserved_ns: "0", policy };
  const ledger = { credited: "100000000000000000000000", finalized_spent: "0", pending_reserved: "0", completed_withdrawals: "0", pending_withdrawals: "0", storage_available: "1000000000000000000000" };
  const key = { nonce: "90071992547409930", block_height: 20, permission: { FunctionCall: { receiver_id: PROOF_VAULT, method_names: ["execute_transfer"], allowance: "99000000000000000000000" } } };
  const view = (value: unknown) => ({ value, blockHeight: 20 });
  const before = { network: "testnet", request, grant: view(grant), owner: view(ledger), intent: view(null), payee: { amount: "10000000000000000000000000", block_height: 20 }, key };
  const settled = { nonce: "0", recipient: PROOF_PAYEE, amount, status: "SETTLED", reason: "OK" };
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
  const event = (name: string, status: string) => "EVENT_JSON:" + JSON.stringify({ standard: "redline", version: "1.0.0", event: name, data: [{ grant_id: request.grant_id, intent_id: request.intent_id, intent: { ...settled, status } }] });
  const receipt = (id: string, executor: string, logs: string[]) => ({ id, block_hash: "block", outcome: { executor_id: executor, logs, status: { SuccessValue: "" } } });
  const transaction = { final_execution_status: "FINAL", transaction: { hash, public_key: PROOF_KEY, nonce: "90071992547409931", signer_id: PROOF_AGENT, receiver_id: PROOF_VAULT, actions: [{ FunctionCall: { method_name: "execute_transfer", deposit: "0", gas: 80000000000000, args: encode(request) } }] }, transaction_outcome: receipt("root", PROOF_AGENT, []), status: { SuccessValue: encode(settled) }, receipts_outcome: [receipt("pending", PROOF_VAULT, [event("intent_pending", "PENDING")]), receipt("payee", PROOF_PAYEE, []), receipt("callback", PROOF_VAULT, [event("intent_completed", "SETTLED")])] };
  const after: any = { ...structuredClone(before), transaction, blocks: { block: { header: { height: 20, timestamp_nanosec: "1793730000000000000" } } } };
  after.grant.value = { ...grant, next_nonce: "1", finalized_spent: amount, finalized_transactions: 1 };
  after.owner.value.finalized_spent = amount; after.intent.value = settled; after.payee.amount = (BigInt(before.payee.amount) + BigInt(amount)).toString(); after.key.nonce = transaction.transaction.nonce;
  return { before, after };
}
describe("ALLOW proof verifier, synthetic consistency vectors only", () => {
  it("checks a complete coherent vector including u64 key nonce", () => { const { before, after } = vector(); expect(verifyAllowProof(before, after).status).toBe("PASS_FINAL_SCOPED_ALLOW"); });
  it.each(["optimistic", "wrongKey", "noCallback", "noPayee", "ledger", "payeeDelta", "pending", "staleSnapshot", "changedRequest", "unsafeScope", "existingIntent"])("refuses %s", kind => {
    const { before, after } = vector();
    if (kind === "optimistic") after.transaction.final_execution_status = "EXECUTED_OPTIMISTIC";
    if (kind === "wrongKey") after.transaction.transaction.public_key = "ed25519:wrong";
    if (kind === "noCallback") after.transaction.receipts_outcome[2].outcome.logs = [];
    if (kind === "noPayee") after.transaction.receipts_outcome.splice(1, 1);
    if (kind === "ledger") after.owner.value.finalized_spent = "0";
    if (kind === "payeeDelta") after.payee.amount = before.payee.amount;
    if (kind === "pending") after.grant.value.pending_reserved = "1";
    if (kind === "staleSnapshot") after.owner.blockHeight = 19;
    if (kind === "changedRequest") after.request.intent_id = "other";
    if (kind === "unsafeScope") after.key.permission.FunctionCall.method_names = [];
    if (kind === "existingIntent") (before.intent as any).value = after.intent.value;
    expect(() => verifyAllowProof(before, after)).toThrow();
  });
});
