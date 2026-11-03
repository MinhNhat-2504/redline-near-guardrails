import assert from "node:assert/strict";
import { grantSchema, transferSchema } from "./types.js";

/** Safe demo client guard only; contract remains authoritative for policy/rejection. */
export function assertDemoSubmission(input: unknown, request: unknown, hasDurableRequest: boolean, now = Date.now()) {
  const grant = grantSchema.parse(input), args = transferSchema.parse(request);
  assert.equal(grant.policy.policy_hash, args.policy_hash, "Reviewed policy changed");
  // Existing durable IDs may be reconciled after expiry; backend must reuse exact packet.
  if (hasDurableRequest) return;
  assert(grant.active, "Grant inactive; no new API submission");
  assert(BigInt(grant.policy.expires_at_ns) > BigInt(now) * 1000000n + 30000000000n,
    "Grant expired or has at most30s remaining. No new API submission; a NEW owner-reviewed grant is required, not just login.");
  assert.equal(grant.next_nonce, args.nonce, "Grant nonce changed; retain request for reconciliation");
  assert(grant.policy.recipients.includes(args.recipient), "Recipient outside reviewed policy");
  assert(BigInt(grant.finalized_spent) + BigInt(grant.pending_reserved) + BigInt(args.amount) <= BigInt(grant.policy.spend_cap), "Grant budget insufficient");
  assert(grant.finalized_transactions + grant.pending_transactions < grant.policy.max_transactions, "Grant transaction limit reached");
}
