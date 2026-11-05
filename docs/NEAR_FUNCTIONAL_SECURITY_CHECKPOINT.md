# Functional and security follow-up - 2026-11-05

Base: `da74fa0`. Phase4/Phase5 remain **PARTIAL**. This is a bounded engineering review, not an independent audit. No wallet keys, session files, public financial transactions or owner signatures were used.

## Changes

The browser previously checked that a grant deadline was within eight hours, but did not bind the returned deadline to the exact1/2/4/8-hour selection used to request it. A backend substitution within that range could therefore reach the owner's review panel. No unauthorized transfer or actual substitution was observed; owner signing and the contract were still required.

The client now captures the exact requested nanosecond deadline before the API call, checks it against the returned policy, and rechecks the same deadline immediately before opening the wallet. The selector is locked while a proposal is being reviewed. The deadline must be a canonical u64 string; unsigned must be the boolean true. Canonical hash, executor, recipient, cap, action, receiver and deposit checks remain. No new authority or larger deadline is introduced. Regression tests use a fully rehashed eight-hour policy against a one-hour selection, one-nanosecond deadline substitutions, malformed/u64-overflow/numeric timestamps and the existing minimum-remaining/maximum-eight-hour constraints.

Additional Policy Lab tests verify:

- An unauthenticated ALLOW prediction supplies no session token and cannot authorize the financial intent endpoint (401, executeTransfer not called).
- Foreign origin, non-JSON, oversized body and extra owner override are blocked before any RPC read.
- Existing HTTP rate limit rejects analysis after90 local injected health requests; no public RPC load test was run.
- A duplicate intent found at the pinned block predicts NONCE_REPLAY; original grant/ledger are unchanged.

## Actual verification

| Command | Result | Evidence under docs/evidence |
|---|---|---|
| Root `npm.cmd run check` | PASS261 tests/32 files, typecheck and Vite build | phase5-followup-frontend.log |
| Backend `npm.cmd run typecheck`, `npm.cmd test`, `npx.cmd tsc -p tsconfig.json` | PASS547 tests/39 files, typecheck and direct build | phase5-followup-backend.log |
| Backend `scripts/test-near-db.ps1` | PASS26 real isolated Postgres tests; temporary container cleaned up | phase5-followup-postgres.log |
| Root `npm.cmd audit --json` | Exit1:10low,0moderate/high/critical | phase5-followup-frontend-audit.json |
| Backend `npm.cmd audit --json` | Exit0:0 findings | phase5-followup-backend-audit.json |

The audit capture shell exits0 to retain the JSON report even when npm audit exits1; the table records the actual npm status, not that wrapper status. No dependency/lockfile upgrade was made. Direct backend tsc avoids regenerating Prisma's Windows DLL while the user's backend may be open. Vite still reports the existing chunk-size warning. No new Rust/sandbox run: contract source/WASM/schema are unchanged. These unit/API tests are synthetic and offline, not new chain proofs.

## Remaining acceptance work, before UI polish

| Requirement | Verified scope | Remaining work |
|---|---|---|
| Wallet sign-in and owner funding/grant/revoke | Owner-operated real browser flow; nine independently verified public financial transactions | Automated browser wallet E2E and explicit cancel/reload branches remain NOT RUN |
| Policy Lab and copilot | Same-block FINAL prediction; owner-observed REVOKED browser result; local gate/security tests | Generative LLM assistant not migrated; deterministic copilot is explicitly labelled |
| Native balance, own vault, history and receipts | Actual public account read, owner-observed balance/history/copy-hash | Copy-link/clipboard-denied browser acceptance and full history indexing not established |
| Pending/reload safety | Durable exact request restoration and matching FINAL completion tests; user screenshot confirmed pending request coexists with read-only analysis | Ambiguous no-hash funding must remain stopped for investigation; no automatic cancellation/reset/unlock. Multi-tab storage is not an atomic lock |
| Async financial safety | Prior21 SDK tests and53 real local sandbox transactions/136 receipts; real Testnet ALLOW/rejections/withdrawal | Callback-liveness and immutable-record growth remain documented operational limitations |
| Owner withdrawal | Contract, unsigned backend proposal and actual CLI withdrawal proof exist | No browser withdrawal UI implemented; avoid presenting CLI support as browser support |
| Newcomer reproduction | README/setup helpers and guided/proof-only path implemented | Independent README-only newcomer/fresh-clone walkthrough NOT RUN |
| CI | Dedicated NEAR workflow definitions exist; equivalent local suites pass | Hosted CI not executed; remote push auth remains unresolved |
| Dependencies | Backend0 findings, frontend10low | Wallet SDK advisory chain remains open; no clean overall audit claim |
| Submission | Provenance/history and proof docs preserved | Licensing confirmation, public repository access, demo video, X/submission remain owner/external work and are not published |

Priority next steps: test remaining read-only clipboard/reload behavior without signatures; validate newcomer setup in an isolated environment; then address the remaining demo/LLM scope explicitly. Any future change to custody, key scope, ambiguous funding disposition or financial recovery must respect owner approval and signature boundaries. Existing revoked demo grant need not be renewed or funded for those checks.


Pre-commit follow-up: staged whitespace PASS; Git reachable-history/staged-index credential-pattern scan PASS1116 blobs/0 findings (phase5-followup-secret-scan.json). Exact inherited TESTONLY fixture exception retained; no entropy/credential-validity audit implied. User-modified phase3-owner-cli-login.json excluded. No remote push attempted because the recorded authentication blocker has not changed.
