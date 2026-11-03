# Verified results — 2026-11-03 (UTC+7)

All PASS entries below were executed. SDK mock contexts, actual local NEAR receipts and public Testnet evidence are distinct classes. Phase 1 results below are historical; subsequent public deployment/init proof is recorded in `TESTNET_PROOF.md`. Public contract transfer/deny/revoke/withdraw proof is now verified in the Phase 2 closeout below.

Environment: Windows/PowerShell Node 24.14.1/npm 11.11.0; Ubuntu WSL Rust/Cargo 1.99.1, Python cryptography 41.0.7; near-sdk 5.30.0; official near-sandbox 2.14.0-rc.5 protocol 88. Cargo invocations used project-local toolchain with Linux temporary cache/target; ordinary Linux reproduction is in `contracts/near-safety-vault/tests/README.md`.

## Canonical commands and evidence

| Command (root unless indicated) | Result | Evidence |
| --- | --- | --- |
| `npm.cmd run check` | PASS: typecheck, 163 tests, Vite build | `evidence/phase1-frontend-regression.log` |
| `npm.cmd run build` (backend) | PASS: Prisma generate + tsc | `evidence/phase1-backend-build.log` |
| `npm.cmd test` (backend) | PASS: 284 tests | `evidence/phase1-backend-regression.log` |
| `cargo fmt --manifest-path contracts/near-safety-vault/Cargo.toml --check` | PASS, exit 0 | `evidence/phase1-fmt.log` (empty success output) |
| `cargo clippy --manifest-path contracts/near-safety-vault/Cargo.toml --locked --offline --all-targets -- -D warnings` | PASS | `evidence/phase1-clippy-final.log` |
| `cargo test --manifest-path contracts/near-safety-vault/Cargo.toml --locked --offline --lib` | PASS: 21 tests, 0 failures/ignored | `evidence/phase1-unit-verified.log` |
| `cargo build --manifest-path contracts/near-safety-vault/Cargo.toml --locked --offline --target wasm32-unknown-unknown --release` | PASS, target cfg near | `evidence/phase1-wasm-near-cfg.log` |
| `python3 contracts/near-safety-vault/tests/sandbox.py --binary .tooling/near88/Linux-x86_64/near-sandbox --wasm contracts/near-safety-vault/target/wasm32-unknown-unknown/release/redline_safety_vault.wasm --evidence docs/evidence/phase1-local-sandbox.json` | PASS: 53 unique local transactions, 136 receipt outcomes | `evidence/phase1-sandbox-verified.log`, `evidence/phase1-local-sandbox.json` |
| Public Testnet RPC `status` | PASS: read-only protocol/runtime query; NOT deployment | `evidence/phase1-testnet-runtime.json` |
| `python scripts/scan-secrets.py` | PASS: 460 history/index blobs, no new credential-pattern findings; exact TESTONLY exception | `evidence/phase1-secret-scan.json` |

Final sandbox-tested WASM SHA-256: `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524` (`evidence/phase1-wasm-sha256-final.txt`).

The successful runtime run includes five SETTLED agent transfers, persisted REJECTED decisions for all seven gates, one genuine failed native transfer whose callback released its reservation, a settled withdrawal, and a concurrent transfer/withdraw race. Eight top-level transaction failures are **expected negative scenarios**, not failed tests. The harness checks every transaction reached FINAL and explicitly checks recipient balance deltas and ledger state. Its transaction hashes belong only to that ephemeral local chain; do not attach public explorer URLs to them.

## Required test matrix

| ID | Status / scope | Evidence |
| --- | --- | --- |
| T01 deposit/grant | PASS: SDK + actual sandbox | 21-test log and sandbox JSON |
| T02 reserve/settle | PASS: SDK pending transition + actual settled native transfer/balance delta | Same |
| T03 owner/executor spoof | PASS: SDK signer-forwarding test, sandbox wrong owner/executor failed receipts | Same |
| T04 destination allowlist | PASS: SDK + persisted sandbox rejection | Same |
| T05 spend cap | PASS: includes pending reservation in SDK and concurrent sandbox requests | Same |
| T06 tx cap | PASS: pending slot in SDK, actual sandbox tx-cap rejection | Same |
| T07 replay | PASS: SDK pending/settled/failed ID + nonce cases, sandbox settled/failed ID replay | Same |
| T08 expiry/revoke/cooldown | PASS: SDK and actual sandbox; observed finalized expiry timestamp included in checks | Same |
| T09 concurrency | PASS: SDK pending interleaving and overlapping real sandbox submissions | Same |
| T10 transfer failure release | PASS: SDK exactly-once callback, missing named sandbox recipient fails transfer and restores available funds | Same |
| T11 callback authenticity/idempotence | PASS: SDK external/duplicate/missing result/unexpected payload, sandbox external private call rejection | Same |
| T12 withdraw safety | PASS: SDK pending transfer/withdraw accounting plus actual sandbox concurrent transfer/withdraw ledger race | Same |
| T13 RPC/indexer restart | PASS in verified direct-call scope: real Postgres restart/dedupe/rollback and public journal reopen; synthetic skipped-block/error tests and two live finalized discovery blocks. Full public history not scanned | Phase 3 DB/live proof |
| T14 TypeScript yocto/timestamp conversion | PASS: exact decimal conversions, u128/u64 bounds, invalid input and ns remainder tests | Phase 3 foundation tests |
| T15 public Testnet demo | PARTIAL overall: public contract/receipts PASS (Phase 2); NEAR UI/API matching NOT RUN | `TESTNET_PROOF.md` |

Additional PASS tests: storage allowance shortage, owner/executor storage payer separation, amount/hash validation, available balance isolation, arithmetic overflow, insufficient gas/liquid reserve, failed withdrawal release.

## Failed attempts retained (resolved, never counted as passing)

- Sandbox 2.13.4/protocol 86: failed contract initialization with unknown host import; `phase1-sandbox-protocol86-failure.json`, `phase1-sandbox-run.log`. Resolved by using Testnet-matched protocol 88.
- WASM without cfg near: named auth-error assertion encountered a generic unreachable trap; `phase1-sandbox-missing-near-cfg.json`, `phase1-sandbox88-run.log`. Resolved by target-specific build cfg and compile guard.
- Harness assumed height fast-forward implied expiry: assertion failed; `phase1-sandbox-clock-assumption.json`, `phase1-sandbox88-final.log`. Resolved by checking actual finalized chain time.
- Initial unit helper had seven temporary-reference lifetime compiler errors; `phase1-unit-final.log`. Corrected explicit reference types; final 21 tests PASS.
- Initial Clippy flagged needless borrow; `phase1-clippy.log`. Fixed; final warnings-as-errors run PASS.
- Early offline build lacked cached aws-lc-sys, and early Cargo jobs were stopped to move cache away from Windows filesystem. They are environment failures/interrupted attempts, not completed tests.

NOT RUN: GitHub-hosted CI execution, independent audit, cargo dependency advisory audit, live database/API E2E. Public Testnet deployment and contract proof are now verified (Phase 2). npm inherited advisories remain open as documented in `BASELINE.md`.

## Phase 2 rechecks - executed 2026-11-03

| Command | Actual result | Evidence |
| --- | --- | --- |
| `python scripts/verify-near-testnet-proof.py` | PASS: ten finalized public transactions, final views, policy binding, callback status and principal/payee reconciliation | `evidence/phase2-proof-verification.json` + raw RPC responses |
| `npm.cmd test` (root) | PASS 163 tests | `evidence/phase2-frontend-test.log` |
| `npm.cmd run build` (root) | PASS typecheck + Vite | `evidence/phase2-frontend-build.log` |
| `npm.cmd test` (backend) | PASS 284 tests | `evidence/phase2-backend-test.log` |
| `npm.cmd run build` (backend) | PASS Prisma generate + TypeScript | `evidence/phase2-backend-build.log` |
| `cargo fmt --manifest-path contracts/near-safety-vault/Cargo.toml -- --check` | PASS | `evidence/phase2-contract-checks.log` |
| `cargo test --manifest-path contracts/near-safety-vault/Cargo.toml` | PASS 21 SDK tests | Same |
| `cargo clippy --manifest-path contracts/near-safety-vault/Cargo.toml --all-targets -- -D warnings` | PASS | Same |
| `cargo build --manifest-path contracts/near-safety-vault/Cargo.toml --target wasm32-unknown-unknown --release` | PASS; rebuilt digest matches deployed artifact | Same; Phase 2 proof |

Rust commands used `wsl bash .tooling/run-rust.sh` with the established project-local toolchain. No contract code changed, so the 53-transaction/136-receipt Phase 1 sandbox suite was not repeated at this checkpoint. Actual public Testnet final receipt/view checks were executed. Earlier usage-limit approval failures are resolved for these queries; no receipt was inferred from screenshot evidence.

## Phase 3 read-only foundation - PARTIAL phase

- Backend `npm.cmd run typecheck` PASS, `npm.cmd test` **329 PASS**, `npm.cmd run build` PASS. Logs: `evidence/phase3-foundation-backend-{test,build}.log`. New 45 tests include actual recorded public receipt inputs and explicitly synthetic mutations/transport stores for negative cases; the latter are not claimed as new chain transactions.
- Live (separate): `npx.cmd tsx scripts/near-read-proof.ts` reads Testnet with new production TS modules, asserts FINAL/SETTLED ALLOW and three exact REJECTED reasons, reads finalized owner ledger; `evidence/phase3-live-read-proof.json`. No signing/broadcast, API routes or database touched.
- First focused run failed 1/43 due an over-u128 test input; contract/code correctly rejected it. Corrected to a valid exact decimal; added negative overflow coverage and two receipt-boundary tests; final full suite 329/329 PASS. This does not erase the initial failure.
- No frontend/contract code changed; their Phase 2 tests/builds were not repeated in this foundation checkpoint. Writable NEAR API, wallet auth/signing, Postgres projection and complete T13/T15 E2E remain NOT RUN/unimplemented.

- Phase 3 checkpoint secret-pattern scan PASS across 558 reachable/staged blobs; no new findings, exact inherited TESTONLY exception retained. Evidence `evidence/phase3-secret-scan.json`; pattern-scan limitations apply.

## Phase 3 approved backend implementation - PARTIAL phase

| Executed command (backend) | Actual result | Evidence |
| --- | --- | --- |
| `npm.cmd run typecheck` | PASS | `evidence/phase3-backend-typecheck.log` |
| `npm.cmd test` | PASS 342 unit tests | `evidence/phase3-backend-unit.log` |
| `npm.cmd run build` | PASS Prisma generate + TypeScript | `evidence/phase3-backend-build.log` |
| `scripts/test-near-db.ps1` | PASS: fresh temporary Postgres, atomic additive migration, 15 integration tests, guarded cleanup | `evidence/phase3-disposable-db-reproduction.log` |
| `scripts/test-near-db.ps1 -LiveProof` | PASS: above + real public Testnet/DB/API reads + actual compiled server startup, signing disabled | `evidence/phase3-fresh-db-live-reproduction.log`, `phase3-live-api-proof.json`, `phase3-startup-smoke.json` |
| `npm.cmd ci --dry-run --ignore-scripts --no-audit --no-fund` | PASS lockfile consistency | `evidence/phase3-lockfile-check.log` |
| `npm.cmd audit --json` | 7 advisories: 2 moderate, 5 high, 0 critical (not a clean audit) | `evidence/phase3-dependency-audit.json` |

Database tests use a new temporary localhost PostgreSQL 16 container with random local credentials, tmpfs data and explicit test-DB name guard. Actual SDK cryptographic signing uses temporary generated test keys; mocked ownership/transport must not be represented as a public account signature or transfer. T14 now also covers exact raw numeric RPC u64 nonce parsing. Live API proof separately checks seven previously signed public transactions, nine deduped events, finalized ledger and public key permission, new DB-client restart, and two finalized block discoveries. It creates no new on-chain transaction. Compiled startup proved CHAIN=near does not serve legacy routes or accept an API-key bypass.

Resolved failed checks: first new signature revalidation failed because Borsh decoded signature was an array; normalize to Uint8Array before verify. First container runner attempted Prisma generation while a live client held the Windows DLL; generate once before live/test processes instead. Retained `phase3-postgres-signature-array-failure.log` and `phase3-db-runner-generate-failure.log`, followed by successful reruns. Initial PowerShell static RNG overload was unavailable and corrected before any test DB started. None is counted as a passing run.

NOT RUN: real owner-wallet NEP-413 login, scoped-key API execution on public Testnet, full historical block scan, Phase 4 NEAR UI E2E and hosted workflow execution. These keep Phase 3 PARTIAL. Frontend/Rust source unchanged; their Phase 2 test/build logs are not relabeled as new runs.

- Approved implementation pre-commit secret-pattern scan PASS: 617 reachable/staged blobs, no new findings, exact inherited TESTONLY exception only. Evidence `evidence/phase3-implementation-secret-scan.json`; pattern-scan limitations apply. All disposable test containers/server processes were stopped with identity guards; the temporary initial connection file was removed. No existing database or real executor key was touched.

## CLI sign-in compatibility checkpoint

- PASS 344 unit tests, 17 real Postgres tests: exact public CLI signature normalization, explicitly issued callback-less payload, strict wallet/CLI cross-mode refusal and prior regression coverage. `phase3-cli-auth-{unit,postgres}.log`.
- PASS npm run typecheck and npx tsc -p tsconfig.json (`phase3-cli-auth-{typecheck,ts-build}.log`). Direct TS compile avoids regenerating a Prisma DLL held by the running user server; no schema change. This is not falsely recorded as npm run build.
- Independent installed-key GET /health PASS (`phase3-installed-key-health.json`). Actual CLI path/version --check-cli PASS (`phase3-cli-login-path-check.log`), no key read/signature. Known restricted esbuild EPERM attempt resolved with permitted check-only execution.
- Actual owner CLI sign-in helper NOT RUN by agent, no session token read, no new financial action. User restart/signature required next. Phase 3 PARTIAL.

## Real-login and RPC-rate checkpoint

- Real user CLI login verified from consumed DB challenge + session metadata (no token/hash selected) + current finalized FullAccess public-key query: PASS, `phase3-owner-login-verification.json`. This supersedes the prior NOT RUN owner-login status, but public scoped-key API transfer remains NOT RUN.
- Actual rpc.testnet.near.org HTTP429 diagnosed while historical reader ran; local balance API returned503. Labeled observation retained, no failed read counted as pass. User stopped backend. Repair tests use fake-clock pacing/cooldown and real Postgres session retention on rate failure; 347 unit/18 DB tests PASS plus typecheck/direct tsc. `phase3-rpc-throttle-*.log`.
- Recovery: two sequential throttled reads on officially listed FASTNEAR Testnet endpoint, finalized ledger conservation PASS (`phase3-rpc-recovery-read.json`). No throughput/load test or wallet signing.
- New unsigned API demo helper --help PASS (`phase3-api-demo-helper-check.log`), before session-file access. Actual user proposal creation and all new funding/grant/API transfer proofs remain pending; no fabricated completion.

## Phase3 key-reset recovery checkpoint

- 380 backend unit tests /31 files, typecheck/direct tsc build PASS.25 real isolated-Postgres integration tests PASS with synthetic RPC fixtures (phase3-key-recovery-postgres.log); seven recovery scenarios verify fresh proof, preserved packet/request binding, no old retry, idempotence, rollback and maintenance races. No real wallet/executor key used by these tests.
- Actual USER-signed same-key reset FINAL proof PASS (phase3-executor-key-reset-{inputs,verification}.json), then actual approved local journal invalidation PASS with fresh public proof, no financial change, no packet/session/secret read. Public-column SELECT confirmed original hash/nonce/binding preserved and no fabricated vault events. Local INVALIDATED is not on-chain settlement.
- Unsigned recovery helper/execute helper/maintenance/verifier strict TypeScript checks PASS; help paths tested only before session access. Explicit --after-key-reset grant preparation remains USER-run, no new grant/signature/transfer by coding agent. New grant needed after15:20:16.906 expiry; scoped80Tgas API settlement still NOT RUN, Phase3 PARTIAL. Frontend/contract unchanged; earlier checks are not presented as reruns.
