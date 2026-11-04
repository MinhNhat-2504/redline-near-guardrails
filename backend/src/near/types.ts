import { z } from "zod";
import { u64, yocto } from "./units.js";

export const accountId = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/);
export const recordId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const hashId = z.string().min(32).max(44).regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
export const amount = z.string().refine(v => { try { yocto(v); return true; } catch { return false; } });
export const positiveAmount = amount.refine(v => { try { return yocto(v) > 0n; } catch { return false; } });
export const uint64 = z.string().refine(v => { try { u64(v); return true; } catch { return false; } });
export const policySchema = z.object({
  executor: accountId, policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
  spend_cap: amount, max_transactions: z.number().int().min(1).max(0xffffffff),
  recipients: z.array(accountId).min(1).max(4), expires_at_ns: uint64, cooldown_ns: uint64,
}).strict();
export const grantSchema = z.object({
  owner: accountId, policy: policySchema, active: z.boolean(),
  finalized_spent: amount, pending_reserved: amount,
  finalized_transactions: z.number().int().nonnegative().max(0xffffffff),
  pending_transactions: z.number().int().nonnegative().max(0xffffffff), next_nonce: uint64,
  has_reserved: z.boolean(), last_reserved_ns: uint64,
}).strict().superRefine((g, ctx) => {
  if (![g.finalized_spent, g.pending_reserved, g.policy.spend_cap].every(v => amount.safeParse(v).success)) return;
  if (BigInt(g.finalized_spent) + BigInt(g.pending_reserved) > BigInt(g.policy.spend_cap) ||
      g.finalized_transactions + g.pending_transactions > g.policy.max_transactions) {
    ctx.addIssue({ code: "custom", message: "Invalid grant reservation ledger" });
  }
});
export const transferSchema = z.object({
  grant_id: recordId, intent_id: recordId, nonce: uint64, asset: z.literal("NEAR"),
  recipient: accountId, amount: positiveAmount, policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type NearGrant = z.infer<typeof grantSchema>;
export type TransferArgs = z.infer<typeof transferSchema>;
export const viewSchema = <T extends z.ZodType>(value: T) => z.object({ value, blockHeight: z.number().int().nonnegative().safe(), blockHash: hashId });
export const ledgerSchema = z.object({
  credited: amount, finalized_spent: amount, pending_reserved: amount,
  completed_withdrawals: amount, pending_withdrawals: amount, storage_available: amount,
}).strict().superRefine((v, ctx) => {
  if (![v.credited, v.finalized_spent, v.pending_reserved, v.completed_withdrawals, v.pending_withdrawals].every(n => amount.safeParse(n).success)) return;
  if (BigInt(v.credited) < BigInt(v.finalized_spent) + BigInt(v.pending_reserved) + BigInt(v.completed_withdrawals) + BigInt(v.pending_withdrawals)) {
    ctx.addIssue({ code: "custom", message: "Invalid principal ledger" });
  }
});
export function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
