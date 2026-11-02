# Execution sequence

Authoritative full handoff: [`../NEAR_REDLINE_MIGRATION_PLAN_AGENT.md`](../NEAR_REDLINE_MIGRATION_PLAN_AGENT.md), read together with the supplied complete PDF.

1. **Phase 0:** preserve Git history, audit source/trust boundaries, build/test baseline, scan secrets, record reuse and push only to new origin. Evidence: `BASELINE.md`, `REUSED_COMPONENTS.md`, `evidence/`.
2. **Phase 1:** isolated Rust near-sdk vault; owner/storage ledger, immutable grants, seven gates, predecessor authorization, replay protection, pending amount/slot reservations, private exactly-once callbacks, safe withdrawals, events/views. Gate: compiled WASM, unit tests and actual sandbox receipt tests, including failure/concurrency and multi-owner isolation.
3. **Phase 2:** dedicated funded NEAR Testnet accounts, approved owner signatures, deploy/hash and real allow/deny/revoke receipts. Stop for credentials/signatures before dependent actions.
4. **Phase 3:** additive NEAR adapter, proper account authentication, integer serialization and resumable receipt/event reader. Preserve MockChain and fail closed on unsupported network config.
5. **Phase 4:** NEAR wallet/dashboard/demo using actual pending/settled/failed/rejected states and correct explorer links.
6. **Phase 5:** threat model, security regression tests, CI and end-to-end quality gate.
7. **Phase 6:** honest README/provenance, reproducible proof/demo package, license and secret review; public/submission actions require explicit owner coordination.

After each phase run applicable tests/builds, save actual evidence in `PROGRESS.md`, commit verified work and continue only across safe boundaries. Marketplace, tokens and swaps remain out of MVP scope. No mainnet activity.
