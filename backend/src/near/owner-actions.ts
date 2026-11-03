import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { accountId, amount, grantSchema, httpError, policySchema, recordId, uint64, viewSchema } from "./types.js";
import type { NearChain } from "../chain/near.js";

const createPolicy = policySchema.omit({ executor: true, policy_hash: true }).strict();
export const ownerActionSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("create_grant"), policy: createPolicy }).strict(),
  z.object({ method: z.literal("deposit"), amount: amount.refine(v => BigInt(v) > 0n) }).strict(),
  z.object({ method: z.literal("storage_deposit"), amount: amount.refine(v => BigInt(v) > 0n) }).strict(),
  z.object({ method: z.literal("revoke_grant"), grantId: recordId }).strict(),
  z.object({ method: z.literal("withdraw"), withdrawalId: recordId, amount: amount.refine(v => BigInt(v) > 0n) }).strict(),
]);

export async function prepareOwnerAction(chain: NearChain, owner: string, input: unknown, nowMs = Date.now()) {
  accountId.parse(owner);
  const action = ownerActionSchema.parse(input);
  let args: Record<string, unknown> = {};
  let deposit = "0";
  let canonical: string | undefined;
  if (action.method === "create_grant") {
    const id = `grant-${randomUUID().replace(/-/g, "")}`;
    const policy = action.policy;
    if (BigInt(policy.spend_cap) === 0n || BigInt(policy.expires_at_ns) <= BigInt(nowMs) * 1_000_000n || new Set(policy.recipients).size !== policy.recipients.length || policy.recipients.includes(chain.config.contractId)) {
      throw httpError(400, "Invalid grant budget, expiry or recipients");
    }
    canonical = JSON.stringify({ schema: "redline.near.policy.v1", network: "testnet", contract_id: chain.config.contractId, owner_id: owner,
      grant_id: id, executor: chain.config.executorId, asset: "NEAR", spend_cap: policy.spend_cap,
      max_transactions: policy.max_transactions, recipients: policy.recipients, expires_at_ns: policy.expires_at_ns, cooldown_ns: policy.cooldown_ns });
    args = { grant_id: id, policy: { ...policy, executor: chain.config.executorId, policy_hash: createHash("sha256").update(canonical).digest("hex") } };
  } else if (action.method === "deposit" || action.method === "storage_deposit") {
    deposit = action.amount;
  } else if (action.method === "revoke_grant") {
    const grant = await chain.readGrant(action.grantId);
    if (!grant || grant.value.owner !== owner) throw httpError(403, "Only the grant owner can revoke");
    args = { grant_id: action.grantId };
  } else {
    const balance = (await chain.readBalance(owner)).value;
    const available = BigInt(balance.credited) - BigInt(balance.finalized_spent) - BigInt(balance.pending_reserved) - BigInt(balance.completed_withdrawals) - BigInt(balance.pending_withdrawals);
    if (BigInt(action.amount) > available) throw httpError(409, "Withdrawal exceeds finalized available principal");
    args = { withdrawal_id: action.withdrawalId, amount: action.amount };
  }
  return { network: "testnet", signerId: owner, unsigned: true, canonicalPolicy: canonical,
    transaction: { receiverId: chain.config.contractId, actions: [{ type: "FunctionCall", params: { methodName: action.method, args, gas: "100000000000000", deposit } }] } };
}
