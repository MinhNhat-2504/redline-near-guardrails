# Review boundary: Zod3 → 4

Status: PROPOSED, not applied. Date:2026-11-04. This is a shared validation compatibility/security decision, not a wallet authorization. No owner key, network signature, grant change, funding or deployment is requested.

## Concrete problem

Backend's pinned Zod3.25.76 remains flagged high by npm audit (GHSA-mrhx-c7xc-m3w5, oversized constrained collection memory exhaustion). Audit suggests4.6.7, a major-version change. Other compatible dependency fixes are implemented and regression-tested; do not suppress this remaining finding or run audit fix --force.

## Proposed scope

- Pin backend Zod4.6.7 and regenerate its lockfile with lifecycle scripts disabled; no Prisma generation/schema/contract changes.
- Review all shared validators, including NEAR auth/receipt/funding/grant/ledger plus inherited Solana routes. Source search finds16 record/default/refinement/type-helper occurrences to inspect, not proof of a complete compatibility inventory.
- Replace one-argument `z.record(z.unknown())` with explicit string-key record schemas where required. Review ZodTypeAny/viewSchema generics, default/optional handling, unknown-key strictness and refinement behavior. Preserve exact unsigned decimal bounds, Ed25519-only auth, owner checks and receipt identity requirements.
- Keep before/after negative vectors for unknown keys, oversized collections, malformed records, u128/u64 boundaries and false FINAL evidence. Reuse all nine real saved browser receipts as offline positive vectors. Add a bounded regression for the reported collection denial-of-service behavior; never load-test public RPC/API.
- Require full backend tests/typecheck/direct build,25 isolated-DB integration tests, full frontend regression and new audit report before committing the migration. No public financial transaction is needed.

## Acceptance and rollback

No weakened validation or identity fallback. Existing saved proof observations must remain identical. Preserve all prior commits/evidence; if incompatible behavior cannot be reconciled, revert the uncommitted package/validator changes and report the specific failure. Do not claim the high advisory resolved until the final installed dependency audit confirms it.

This crosses the owner's requested stop point for security-critical decisions because both NEAR and legacy financial input validators share the dependency. Review of this proposal is separate from any future production release or wallet operation. The current local Testnet-only API has a32KiB body limit, but that is a partial mitigation, not a security exception or completed Phase5 gate.
