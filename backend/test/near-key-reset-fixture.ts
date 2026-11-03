// Synthetic RPC fixtures, never public transaction proof.
import type { ResetInputs, ResetPlan } from "../src/near/key-reset.js";
export const block = "1".repeat(32), resetHash = "2".repeat(43), publicKey = "ed25519:" + "3".repeat(43);
export function fixture(): { plan: ResetPlan; input: ResetInputs } {
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
