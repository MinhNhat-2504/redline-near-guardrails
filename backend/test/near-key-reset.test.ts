// Synthetic RPC fixtures only; no public key reset/signature/transaction performed.
import { describe, expect, it } from "vitest";
import { verifyKeyReset, type ResetInputs, type ResetPlan } from "../src/near/key-reset.js";

const block = "1".repeat(32), resetHash = "2".repeat(43), publicKey = "ed25519:" + "3".repeat(43);
function fixture(): { plan: ResetPlan; input: ResetInputs } {
  const permission = { FunctionCall: { receiver_id: "vault.testnet", method_names: ["execute_transfer"], allowance: "100000000000000000000000" } };
  const policy = { executor: "agent.testnet", policy_hash: "a".repeat(64), spend_cap: "50000000000000000000000", max_transactions: 3, recipients: ["payee.testnet"], expires_at_ns: "18446744073709551615", cooldown_ns: "0" };
  const ledger = { credited: "600000000000000000000000", finalized_spent: "50000000000000000000000", completed_withdrawals: "450000000000000000000000", pending_reserved: "0", pending_withdrawals: "0", storage_available: "44010000000000000000000" };
  const view = (value: unknown) => ({ value, blockHeight: 102, blockHash: block });
  const outcome = { block_hash: block, outcome: { status: { SuccessValue: "" } } };
  return {
    plan: { executor: "agent.testnet", owner: "owner.testnet", contract: "vault.testnet", publicKey, oldHash: "4".repeat(43), oldKeyNonce: "10", resetHash,
      args: { grant_id: "grant", intent_id: "intent", nonce: "0", asset: "NEAR", recipient: "payee.testnet", amount: "10000000000000000000000", policy_hash: policy.policy_hash }, policy, baselineLedger: ledger, baselinePayee: "10050000000000000000000000" },
    input: {
      reset: { final_execution_status: "FINAL", status: { SuccessValue: "" }, transaction: { hash: resetHash, signer_id: "agent.testnet", receiver_id: "agent.testnet", public_key: "ed25519:" + "5".repeat(43),
        actions: [{ DeleteKey: { public_key: publicKey } }, { AddKey: { public_key: publicKey, access_key: { nonce: "0", permission } } }] }, transaction_outcome: outcome, receipts_outcome: [outcome] },
      blocks: [{ header: { hash: block, height: 101 } }], access: { nonce: "11", block_height: 102, block_hash: block, permission },
      signingAccess: { nonce: "20", block_height: 102, block_hash: block, permission: "FullAccess" },
      grant: view({ owner: "owner.testnet", policy, active: true, finalized_spent: "0", pending_reserved: "0", finalized_transactions: 0, pending_transactions: 0, next_nonce: "0", has_reserved: false, last_reserved_ns: "0" }),
      ledger: view(ledger), intent: view(null), payee: { amount: "10050000000000000000000000", block_height: 102, block_hash: block }, originalUnknown: true,
    },
  };
}
describe("read-only finalized scoped key reset verification", () => {
  it("proves nonce invalidation without declaring settlement or mutating a journal", () => {
    const { plan, input } = fixture(); const before = JSON.stringify({ plan, input });
    expect(verifyKeyReset(plan, input)).toMatchObject({ status: "VERIFIED_KEY_RESET_ONLY", finalizedKeyNonce: "11", oldKeyNonce: "10", originalIntentAbsent: true, financialBaselinesUnchanged: true, journalChanged: false, replacementSigned: false });
    expect(JSON.stringify({ plan, input })).toBe(before);
  });
  it.each([
    ["non-final reset", (i: any) => { i.reset.final_execution_status = "INCLUDED"; }],
    ["failed receipt", (i: any) => { i.reset.receipts_outcome[0] = { block_hash: block, outcome: { status: { Failure: {} } } }; }],
    ["extra action", (i: any) => { i.reset.transaction.actions.push({ Transfer: { deposit: "1" } }); }],
    ["wrong signer", (i: any) => { i.reset.transaction.signer_id = "other.testnet"; }],
    ["wrong receiver", (i: any) => { i.reset.transaction.receiver_id = "other.testnet"; }],
    ["same scoped signer", (i: any) => { i.reset.transaction.public_key = publicKey; }],
    ["broadened key", (i: any) => { i.reset.transaction.actions[1].AddKey.access_key.permission = "FullAccess"; }],
    ["increased allowance", (i: any) => { i.reset.transaction.actions[1].AddKey.access_key.permission = { FunctionCall: { receiver_id: "vault.testnet", method_names: ["execute_transfer"], allowance: "200000000000000000000000" } }; }],
    ["different public key", (i: any) => { i.reset.transaction.actions[1].AddKey.public_key = "ed25519:other"; }],
    ["nonzero add-key nonce", (i: any) => { i.reset.transaction.actions[1].AddKey.access_key.nonce = "1"; }],
    ["unchanged nonce", (i: any) => { i.access.nonce = "10"; }],
    ["stale access snapshot", (i: any) => { i.access.block_height = 100; }],
    ["missing execution block", (i: any) => { i.blocks = []; }],
    ["ambiguous execution block", (i: any) => { i.blocks.push(i.blocks[0]); }],
    ["unavailable original transaction", (i: any) => { i.originalUnknown = false; }],
    ["existing on-chain intent", (i: any) => { i.intent.value = { status: "PENDING" }; }],
    ["advanced contract nonce", (i: any) => { i.grant.value.next_nonce = "1"; }],
    ["reserved contract funds", (i: any) => { i.grant.value.pending_reserved = "1"; }],
    ["different policy", (i: any) => { i.grant.value.policy = { ...i.grant.value.policy, cooldown_ns: "1" }; }],
    ["changed principal", (i: any) => { i.ledger.value = { ...i.ledger.value, credited: "700000000000000000000000" }; }],
    ["changed payee balance", (i: any) => { i.payee.amount = "10060000000000000000000000"; }],
    ["financial snapshot before reset", (i: any) => { i.intent.blockHeight = 100; }],
  ])("refuses %s", (_name, mutate) => {
    const { plan, input } = fixture(); mutate(input); expect(() => verifyKeyReset(plan, input)).toThrow();
  });
  it("flags expiry without silently issuing a new grant", () => {
    const { plan, input } = fixture(); (plan.policy as any).expires_at_ns = "1";
    expect(verifyKeyReset(plan, input).grantExpiredAtVerification).toBe(true);
  });
});
