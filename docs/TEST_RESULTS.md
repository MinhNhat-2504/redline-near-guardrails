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

## Phase3 actual API EXPIRED proof and safe-client regression

- Actual USER-run scoped-key80Tgas API tx Gqv1YhjYHr9ZVkLnEscPmHFSAWDZ5TcgHhCUxvPPmxGQ independently verified FINAL REJECTED/EXPIRED with production receipt parser, stored intent, vault event and execution block after deadline. Principal/payee unchanged, no payee receipt; gas/storage charged. phase3-api-expired-verification.json and actual RPC responses. This proves real API rejection, not ALLOW/settlement.
- 384 unit tests/32 files + typecheck/direct build PASS;4 new guard regressions cover saved local expiry,30s boundary, preserved durable reconciliation and nonce/hash mismatch. Helper/verifier strict compile and unsigned renewal help PASS. Prior25 Postgres tests not rerun; no DB logic changed. Real renewal preparation/signature/new successful transfer pending USER actions. Phase3 PARTIAL.

## Approved maximum8h demo option

- 399 unit tests/33 files, typecheck/direct build, standalone strict helper compile and --help PASS.15 new cases cover bounded whole-hour CLI input/order/duplicates, exact8h nanoseconds/u64 overflow, unchanged retry/legacy deadlines, forged/future metadata and actual unsigned-owner canonical hash binding. Fixed-clock/mock-config only; no public8h grant/key/token/signature used. First standalone helper compile caught narrowed CLI-mode type, corrected and rerun PASS.
- Prior25 Postgres tests remain earlier evidence, no DB/schema/server/contract change. USER must explicitly choose --grant-hours8 (space before8) and owner-sign new policy; default1h and existing proposals unchanged. Actual8h proposal/grant/ALLOW proof NOT RUN by coding agent; Phase3 PARTIAL.
# Phase4 browser implementation checkpoint — 2026-11-03

- `npm.cmd run test`: PASS183 tests/25 files;20 new browser model/wallet tests. Wallet transport is mocked, not public wallet proof. Raw `docs/evidence/phase4-frontend-tests.log`.
- `npm.cmd run build`: PASS root typecheck + Vite production build; wallet chunk warning >500kB retained in `phase4-frontend-build.log`.
- Backend `npm.cmd run test`: PASS411 tests/34 files;12 new ALLOW consistency tests use synthetic vectors, never transaction evidence. `phase4-backend-regression.log`.
- Backend `npm.cmd run typecheck`, `npx.cmd tsc -p tsconfig.json`, standalone `npx.cmd tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/capture-near-allow-proof.ts scripts/verify-near-owner-grant.ts`: PASS; `phase4-backend-build.log`. First helper compile caught unknown RPC view types; corrected with runtime viewSchema parsing, then rerun. Direct compile avoids regenerating Prisma DLL while owner backend may run.
- Public helper `--help`: PASS outside sandbox after initial tsx/esbuild spawn EPERM; `phase4-public-helper-help.log`. No wallet/session access or submission.
- Actual `verify-near-owner-grant.ts <public-package> 3q9hhGTRCS3UNn2V3PZndzzzsxYgYPnZD7vPKUzT147R <new-prefix>`: PASS_FINAL_OWNER_GRANT_PREFLIGHT, actual RPC inputs/report `phase3-eight-hour-signed-*`. ALLOW is still pending.
- `npm.cmd audit --json`: completed, exit1 due16 advisories (10low/3moderate/3high/0critical), `phase4-dependency-audit.json`; not a clean audit PASS.
- Browser E2E/signing, scoped API ALLOW, fresh DB integration, Rust/sandbox: NOT RUN at this checkpoint. Existing Phase2/public expiry/local sandbox evidence retained separately; no claims of a rerun or completed migration.
# Phase3 actual scoped ALLOW closure — 2026-11-03

- Read-only AFTER RPC capture for GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ + offline `capture-near-allow-proof.ts verify`: PASS_FINAL_SCOPED_ALLOW on real data; exact API response separately matched. Six receipts, stored/callback SETTLED/OK; payee/ledger delta conserved. `phase3-api-allow-*` contains the real inputs and report. This is not a mocked transfer.
- Frontend `npm.cmd run test`183 tests/25 files and `npm.cmd run build` PASS; backend `npm.cmd run test`411 tests/34 files, `npm.cmd run typecheck`, direct `npx.cmd tsc -p tsconfig.json` PASS. Logs `phase3-allow-{frontend,backend}-{tests,build}.log`. Vite wallet-chunk >500kB warning retained.
- No new DB/Rust/sandbox run; no schema or contract change. Browser signing/E2E and a public replay demonstration remain NOT RUN. Phase3 adapter/auth/scoped receipt MVP gate PASS; migration overall still incomplete.
# Phase4 live browser connection and request durability — 2026-11-03

- USER screenshot confirms public grant/ledger rendering, not browser authentication. Actual login failed because MyNearWallet SDK10.1.4 disconnected sentinel is a nonempty array with empty account ID. Source-verified integration bug fixed; live user retry after fix pending.
- Root `npm.cmd run test`: PASS211 tests/26 files; `npm.cmd run build`: PASS typecheck + Vite build. Logs `phase4-wallet-connection-{tests,build}.log`. Intermediate request-only208 tests/build logs retained as `phase4-intent-durability-*`.28 new cases cover storage durability/strict restore/FINAL binding and empty-account connection. No new signing/network or fabricated wallet result.
- Backend411/real DB/contract/sandbox results not rerun here; no backend/schema/contract change. New feature-branch frontend CI configured, manually reviewed but not executed remotely; YAML parser unavailable, no automated YAML lint claimed. Phase4/5 still incomplete; no visual redesign per owner instruction.
# Phase4 wallet provider replacement — 2026-11-03

- USER's real popup confirms MyNearWallet no longer accepts new application connections. Selected Intear10.1.4 after checking official/installed adapter callback/network handling; evaluated Meteor wrapper drops callbackUrl and was removed without an authentication fallback.
- `npm.cmd run test`: PASS212 tests/27 files; `npm.cmd run build`: PASS typecheck/Vite build. `phase4-wallet-provider-{tests,build}.log`. Actual installed Intear adapter runs in synthetic DOM/messages/socket and generated test app key, verifies exact Testnet/no-contract-authority/callback forwarding; no real wallet/signature or network transaction claimed. First compile found optional signMessage invocation in the test; explicit guard added and checks rerun.
- Final audit completed exit1 with16 advisories, `phase4-intear-dependency-audit.json`; removed Meteor trial audit21 is separate historical evidence, not current dependency state. >500kB warning retained. No backend/schema/contract changes or backend/DB/Rust rerun. Owner Intear browser E2E remains NOT RUN; Phase4 PARTIAL.
# Phase4 missing browser Buffer — 2026-11-03

- Live user error `Buffer is not defined`; source inspection found Wallet Selector uses global Buffer beyond our local import. Added absent-only browser bootstrap using existing buffer6.0.3 before SDK operations, preserving existing implementations.
- `npm.cmd run test`: PASS214 tests/28 files; `npm.cmd run build`: PASS typecheck/Vite build. `phase4-browser-buffer-{tests,build}.log`. Real SDK NEP-413 serializer under missing global reproduces failure then passes with unchanged callback binding after bootstrap. This synthetic browser condition is not real browser E2E.
- No backend/schema/contract/dependency changes; no backend/DB/Rust rerun. Actual browser login remains pending. New web Testnet account is separate from the original grant owner; no new funding or transfer requested here.
# Phase4 authenticated button state — 2026-11-03

- USER screenshot shows Intear sign-in completed for nhat-redline-web.testnet, but both login/logout were rendered. Corrected conditional controls/status/hint; no authentication-policy change.
- `npm.cmd run check` PASS:214 tests/28 files, typecheck and Vite build; `phase4-login-state-checks.log`. Chunk warning remains. Browser sign-in observation does not establish the remaining browser financial walkthrough; no token/private-key collection or backend/DB/Rust rerun.
# Phase4 web-owner setup and funding reconciliation — 2026-11-03

- Root221 tests/29 files + typecheck/Vite build PASS; backend424 tests/35 files + typecheck/direct tsc PASS.25 real isolated Postgres integration tests PASS, disposable container cleaned up; no existing DB/schema/contract change or Prisma regeneration. Logs `phase4-web-funding-*`; strict standalone helper compile/help PASS. Chunk warning remains.
- Actual public web-owner baseline:2.5nativeNEAR, vault explicitly unregistered at block276072399. `phase4-web-owner-before-funding.json`. First view shape and escaped GuestPanic matching attempts failed before correction; only successful final capture used as evidence.
- Funding tests cover exact fixed review amount, storage-before-principal/no automatic replenishment, malformed/overspent ledger, durable attempt, changed/optimistic/old hash blocking,401 before RPC and real saved Phase2 owner funding receipts. Those old receipts/synthetic vectors are not new web wallet transactions. Browser funding/signing/grant E2E NOT RUN; Phase4 PARTIAL pending owner approval/signatures.

- Phase4 scroll fix (2026-11-03): inherited legacy body overflow:hidden clipped the NEAR page; added a dedicated viewport-height vertical scroll container in src/near/near.css. CSS-only change preserves the current login/proposal through Vite HMR. USER screenshot shows unsigned storage proposal prepared, no web funding signature yet. Root check:221 tests/29 files, typecheck and Vite build PASS (phase4-scroll-checks.log); existing chunk warning remains. Browser scroll confirmation pending; no backend/DB/contract changes or reruns. Phase4 remains PARTIAL.

- 2026-11-04 independent browser ALLOW receipt verification PASS: USER supplied exact tx6dQsYKnAqx3y5bQYwSHD3LeVktSpMiKSnX9LLV6VRZoe. Public-only verify-near-web-allow.ts uses production receipt parser and confirms FINAL SETTLED/OK, six successful receipt outcomes, vault completion event, exact stored intent/returned value, scoped9hau... public key, execute_transfer80Tgas/deposit0, nonce0, native0.01 to approved payee, and web-owner/current-key scope binding. Raw transaction/receipt block headers/current grant/intent/key/ledger archived in phase4-web-allow-verification.json. Current grant is revoked; historical ALLOW remains SETTLED.
- Limitations: no historical before/payee balance-delta proof captured; current snapshots do not establish that delta. Other browser funding/grant/rejection/revoke receipts remain independently unverified. Phase4 remains PARTIAL. Helper strict standalone tsc,424 backend tests/35 files and direct backend tsc build PASS; phase4-web-allow-backend-tests.log. No frontend/DB/contract changes/reruns, credentials/session reads or financial broadcast. Next collect public Explorer URLs for remaining browser cases; no new signing required.

- 2026-11-04 four browser adversarial receipts independently VERIFIED: CX71RxEViVW2xrVxQBtELiPNic8NwCMchoxwxhvfymtX=SPEND_CAP_EXCEEDED; GympRgkPjYkNLa6NTDp6eaALgh5hTiHnhNi6T7PYJ5pX=DESTINATION_NOT_ALLOWED; 9LdgMWE3aE7PJ3vHa9veApZ6yFdRstVfwKRPdS9fdV1w=NONCE_REPLAY; FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP=REVOKED. Public-only helper verify-near-web-rejections.ts checks production parser FINAL/REJECTED/exact reason, scoped public key/80Tgas/deposit0/native asset, exact grant/policy/nonce/recipient/amount, unique intents and stored intent=return. Receipt outcomes contain no requested-recipient execution, pending/completion event or failed receipt. Raw tx/receipt block headers/intent/current ledger/grant archived in phase4-web-rejections-verification.json.
- Current independent FINAL invariants: web owner credited0.1/spent0.01/available0.09, withdrawals0/pending0; grant revoked, next_nonce1, spent0.01/pending0. These current values are not historical per-case before/after balance proof. ALLOW + four rejection receipt checks now PASS; owner funding/create_grant/revoke_grant receipts remain separate verification work, Phase4 still PARTIAL. No repeat signatures/funding/reset needed.
- Strict standalone TypeScript helper check,424 backend tests/35 files and direct backend tsc build PASS (phase4-web-rejections-backend-tests.log). No frontend/DB/contract changes or reruns, no credential/session access or financial broadcast. Next collect public links for two browser Owner action rows (create/revoke), plus funding hashes. UI polish deferred; remote push authentication still blocked.

- 2026-11-04 browser owner actions independently FINAL VERIFIED: 7UKKxLJyiFJLiBLr92CRbe8gP21czuv5ru8Du9bWXLM3=create_grant (block276075262); 2XojCUvx1QLkA1tsPKS4AM8tacjQjp3Ubv6ZJLFcfJVd=revoke_grant (block276077048). Methods identified from chain, not UI row order. Exact web-owner signer/vault/single call/100Tgas/deposit0, grant ID, production parser CONFIRMED and owner events verified. Canonical SHA256 policy matches signed args/current policy: executor agent, native cap0.05/max3/only payee/cooldown0, valid remaining lifetime<=8h at execution. Creation precedes revoke, current active=false. Raw transactions/receipt blocks/grant in phase4-web-owner-actions-verification.json.
- Read-only verify-near-web-owner-actions.ts standalone strict tsc,424 backend tests/35 files/direct tsc build PASS (phase4-web-owner-actions-backend-tests.log). No frontend/DB/contract changes or reruns, no keys/session/broadcast. ALLOW, four rejection and create/revoke receipts now independently verified. Storage0.05/deposit0.1 browser funding receipt archive remains pending; Phase4 stays PARTIAL, no exact historical payee-delta proof inferred. Next obtain public funding hashes from wallet history; no new signature or funding needed. Remote Git authentication blocker remains.

- 2026-11-04 browser storage receipt independently VERIFIED FINAL:3HWgnSzk6Zo1Q87zaoKYLjvqTnbKYbNHEqmRD13Ud14Z, vault execution block276074899. Public helper verify-near-web-funding.ts reuses production observeFunding: exact web-owner/vault/single storage_deposit/empty args/100Tgas/attached0.05. Successful historical return: storage0.04835, credited/spent/withdrawals/pending0. Raw receipt/blocks/current funding archived phase4-web-storage-verification.json. Original in-memory review timestamp/durable attempt not independently available; no proposal-timing proof inferred.
- Generic read-only helper also supports exact initial deposit0.1 once hash supplied. Strict helper tsc,424 backend tests/35 files and direct tsc build PASS (phase4-web-funding-proof-backend-tests.log). No frontend/DB/contract changes/reruns, secret/session reads or broadcasts. USER's accompanying image is the already-verified revoke, not principal deposit. Next identify deposit0.1 in wallet history; never repeat funding. Phase4 PARTIAL; Git push auth blocker unchanged.

- 2026-11-04 final browser funding receipt independently VERIFIED:7F4EigWDUF8X8TNQcqhQ4m8H8h7syNV8MdEt8vKKzS3x, deposit0.1NEAR, vault execution block276075107. Existing read-only funding verifier confirms FINAL CONFIRMED/exact web-owner/vault/empty args/100Tgas and successful historical ledger credited0.1/spent0/withdrawals0/pending0/storage0.04835. Evidence phase4-web-principal-verification.json. No new signature or broadcast.
- Browser financial walkthrough milestone VERIFIED: all9 financial tx (storage, deposit, create, ALLOW, cap/recipient/nonce rejections, revoke, revoked rejection) have public RPC receipt evidence. Updated NEAR_BROWSER_DEMO.md to remove obsolete NOT RUN statements and link evidence matrix. No historical payee before/after delta or automated browser E2E claimed. Full Phase4 still PARTIAL: README-only newcomer/one-click guided acceptance not validated, broader UI integration requirements remain for audit. Next audit remaining Phase4/Phase5 requirements against source and evidence before cosmetic redesign. No further owner signatures needed for this proof checkpoint.
- Evidence/docs only, verifier unchanged since prior strict compile/424 backend tests/direct build PASS; checks not rerun without code change. No frontend/DB/contract mutation. Git whitespace check required before commit; user-modified login report retained. Git push authentication blocker remains.

# Phase 5 — bounded security review and safe hardening (2026-11-04, UTC+7)
- Status: PARTIAL. Base commit c914062; full review/findings and remaining Phase4 gaps in docs/PHASE5_SECURITY_REVIEW.md. This is not an independent audit or a public-release approval.
- NEW NEAR changes: explicit no-store/nosniff API headers;24 additional offline/injected security regressions over real browser receipt fixtures and synthetic negative mutations. CI backend now explicitly read-only,20-minute timeout and fixture-trigger paths. Added reproducible local Rust/sandbox gate script with LF checkout attribute.
- Shared compatible dependency patches: frontend Vite6.4.5/Vitest4.1.12 and compatible transitive updates; backend Fastify5.12.8/Vitest4.1.12/fast-uri. Existing pinned Zod3 unchanged. Legacy server import/error-handler generic is a TYPE-ONLY Fastify compatibility edit, no business behavior change; former verbatim source remains in history.
- Actual verification PASS: frontend221 tests/29 files+typecheck/Vite build; backend448 tests/36 files+typecheck/direct tsc;25 real isolated Postgres tests; Rust fmt/21 SDK tests/Clippy/WASM + real sandbox53 transactions/136 receipts. WASM hash remains ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524. Final logs phase5-*-checks-final.log, phase5-postgres-final.log, phase5-contract-security.log and phase5-local-sandbox.json. Temporary DB container cleaned up; existing user DB/backend and public chain untouched.
- First Fastify typecheck FAIL retained in phase5-backend-typecheck-initial-failure.log; corrected using explicit FastifyError generic and full affected checks rerun PASS. Intermediate dependency reports retained, not represented as final clean audit.
- Dependency audit remains FAIL(exit1): frontend16→10low/backend7→1high(Zod);0critical. Current sources reviewed: official NEAR callback/access-key/NEP413 and Fastify advisory; links in review doc. No new critical spend-policy bypass identified within bounded review, not a safety guarantee. Browser/hosted CI automation and newcomer README-only acceptance NOT RUN. Lockfile npm ci --ignore-scripts --dry-run PASS for both, not a fresh install/E2E claim.
- Security decision boundary: proposed shared Zod3→4.6.7 migration needs review before applying; concrete scope/acceptance/rollback in docs/NEAR_ZOD4_MIGRATION_PROPOSAL.md. Do not force-upgrade, suppress advisory or ask for wallet credentials. No owner signature, funding, key reset or deployment needed. Prototype remains Testnet-only.
- README/runbooks/threat/evidence statuses corrected for nine independently verified browser financial transactions; Phase4 still PARTIAL (guided/newcomer, network/native wallet balance and dashboard/PolicyLab integration gaps), visual redesign deferred. Secret pattern scan and whitespace check recorded separately after staging. Remote push still blocked by owner GitHub auth; user-modified phase3-owner-cli-login.json excluded.

- Phase5 pre-commit verification: staged whitespace PASS; scoped Git history/index credential-pattern scan PASS, 1004 blobs,0 findings; exact inherited TESTONLY fixture exception retained. Raw report phase5-secret-scan.json. Pattern scope only, no entropy/credential audit claim. User-modified phase3-owner-cli-login.json not staged.

- 2026-11-04 approved Zod3→4.6.7 migration PASS, base5d39f0a. Explicit owner approval retained; implementation/commands/limitations in docs/ZOD4_MIGRATION_RESULTS.md. Updated five record definitions/generic and controlled malformed-decimal validation without loosening accepted financial inputs.57 before/after cases same acceptance/valid outputs, three former native exceptions now controlled rejections;61 added tests. Nine real saved browser financial receipts remain offline regression vectors, not new chain proof.
- Actual checks PASS: backend509 tests/37 files+typecheck/direct tsc,25 REAL isolated Postgres tests, frontend221 tests/29 files+typecheck/Vite build, strict helper compile, corpus compare and npm ci dry-run. Backend audit0 findings/exit0; frontend10low/exit1. Logs phase5-zod4-*; preceding contract/sandbox unchanged, not rerun. Existing DB/backend retained, no Prisma generation, credentials/session reads or public transactions. User-modified login report excluded; remote push auth blocker remains.
- Overall Phase4/5 still PARTIAL due documented newcomer/guided integration/hosted/browser automation and frontend low dependency findings. Next safe work: close functional onboarding/navigation/balance gaps before UI polish. No new migration approval or wallet signature needed. Secret-pattern scan/whitespace results recorded separately before commit.

- Zod4 pre-commit: Git history/index credential-pattern scan PASS, 1036 blobs/0 findings; inherited exact TESTONLY fixture exception retained. Pattern scope only; user login report excluded. Staged whitespace PASS. Evidence phase5-zod4-secret-scan.json.

- 2026-11-04 newcomer functional checkpoint, base02c7afd: added state-based guidance/setup help/read-only proof path and all nine browser proof links; safe restore of public pending records without auto-submit;401 returns login controls while preserving request/503 retains session. Native account FINAL amount/locked/block displayed separately from vault/storage/spendable gas. New read-only account endpoint and auth-scoped owner history include grantless funding, hide packet/args and isolate foreign signers. Receipt copy hash/link with selectable fallback; navigation between NEAR and retained legacy dashboard opens separate tabs, no wallet network change. ALLOW refresh also updates logged-in owner's vault ledger. No cosmetic redesign/financial signing change.
- Actual checks PASS: frontend228 tests/31 files+typecheck/Vite build; backend517 tests/38 files+typecheck/direct build;26 REAL disposable Postgres tests including grantless history/owner isolation/no packet leak. Public parser/helper read FINAL web account at block276162643; phase4-onboarding-public-account.json. Final logs phase4-onboarding-*-final.log and phase4-onboarding-postgres.log; helper strict compile PASS. Native amount is raw account amount, not guaranteed spendable gas. Vite chunk/Prisma update banner stderr records are informational, commands exit0. No Prisma generation/existing DB modification/contract change or new public transaction; no Rust/sandbox rerun.
- Docs NEAR_FIRST_RUN.md/NEAR_ONBOARDING_CHECKPOINT.md plus README/runbooks distinguish proof-only/resume/fresh signed setup. New routes need USER backend restart; keep Vite5173. Browser visual/clipboard/real new-control acceptance NOT RUN (no automation tool); original nine verified browser financial receipts unchanged. Phase4/5 remain PARTIAL; legacy copilot/PolicyLab are preserved/reachable but not wired to NEAR signing. Fresh-clone newcomer and hosted CI pending; dependency state unchanged(previous backend audit0/frontend10low). No repeat deposit/grant/key reset. Git push auth blocker/user-modified login report retained.

- Onboarding pre-commit: staged whitespace PASS; scoped Git history/index credential-pattern scan PASS, 1067 blobs/0 findings; exact inherited TESTONLY fixture exception retained. Report phase4-onboarding-secret-scan.json. Pattern scope only; user-modified login report excluded.


## NEAR Policy Lab / rule-based copilot checkpoint - 2026-11-04

Base42dd156; implementation details/commands/limits: docs/NEAR_POLICY_LAB.md. Added public read-only analysis pinned to a single FINAL block for grant/owner ledger/optional duplicate intent and block time. Exact u64/u128 gate precedence mirrors Rust; pending caps/counts/withdrawals and cooldown included. No client policy override, DB mutation, key loading, signing or broadcast. NEAR browser lab displays gate explanations and snapshot provenance; ALLOW can enter existing durable intent review only for matching owner/native NEAR/reviewed payee/cap/nonce/hash. Separate explicit submission and owner grant signatures retained. Original Solana USDC PolicyLab and LLM assistant remain preserved; this copilot is deterministic, not generative LLM.

Checks PASS: frontend249 tests/32 files+typecheck/Vite build; backend543 tests/39 files+typecheck/direct tsc build;26 REAL isolated Postgres integration tests; standalone helper strict compile. Logs docs/evidence/phase4-policy-lab-*.log. Fixed Vitest discovery to include TSX; final249 includes new21 frontend tests (initial228 excluded TSX). Actual public read at FINAL block276166710/hashFTCMrfaDXzyGuVEnchcuM2eSH3GgLKMMXyJHDpKgMyzH predicted REVOKED for historical grant; snapshot saved phase4-policy-lab-public-snapshot.json. This is a read-only prediction, not a new receipt or transfer. No contract/schema/dependency changes; Rust/sandbox and npm audits not rerun. Existing DB and user login report untouched.

Phase4/5 PARTIAL: manual new-lab browser acceptance, generative LLM migration, fresh-clone newcomer, recovery branches and hosted CI remain outstanding. No new wallet signatures, funding or key reset needed to inspect historical grant. UI polish deferred; remote Git push auth blocker unchanged. Next: user verifies read-only lab; continue functional acceptance/security gaps before cosmetic redesign.


## Functional/security follow-up - 2026-11-05

Base da74fa0. Exact requested grant deadline now bound before proposal display and again before wallet opening; canonical u64 and boolean unsigned checks added. Hours selector locked during proposal review. No observed unauthorized transfer; this closes proposal-substitution ambiguity without changing owner signing or executor scope. Added offline/injected tests for ALLOW not authorizing transfers, no session leakage, origin/body/content-type/override boundaries, local rate limit and duplicate intent. Details and acceptance matrix: docs/NEAR_FUNCTIONAL_SECURITY_CHECKPOINT.md.

Actual results: frontend261 tests/32 files+typecheck/Vite build PASS; backend547 tests/39 files+typecheck/direct build PASS;26 REAL isolated Postgres tests PASS. npm audit backend0/exit0; frontend10low/exit1, zero moderate/high/critical. No package upgrades; no contract/schema changes or new Rust/sandbox run. Logs/reports phase5-followup-*. Existing user DB/login report preserved; no wallet signatures, secrets/session reads or public financial submissions.

Phase4/5 remain PARTIAL. Policy Lab read-only browser acceptance already owner-observed; generative LLM migration, independent newcomer/fresh-clone acceptance, clipboard-denied/cancel/reload browser coverage and hosted CI remain incomplete. Browser withdrawal UI is not implemented (contract/backend/CLI proof exist). No ambiguous funding unlock or cross-tab atomicity is claimed. Remote push auth and license/public-submission owner work remain unresolved. Next safe work is read-only recovery/clipboard/newcomer verification before UI redesign.


## New installation and cancel/reload checkpoint - 2026-11-05

Base91b6fc1. Local pending/funding recovery now precedes API health, restores each record independently, handles blocked storage getter and selects a saved intent grant over stale navigation. Corrupt recovery blocks financial preparation/signing/submission but retains records and allows public reads when connected. Auth callback URL/challenge remain until successful verification; connection retry also retries that callback. Session identity/token shape checked. Local cancel disabled after wallet/API operation starts; no no-hash funding unlock or automatic re-sign introduced. See docs/NEAR_RELOAD_ACCEPTANCE.md.

Final workspace frontend277 tests/34 files+typecheck/Vite build PASS;16 new recovery/cancel/callback tests use synthetic storage/transport (not real browser wallet E2E). Initial3 test failures from old test-session fixture shape retained, then fixed to actual43-character token without weakening validation. Source-only cache-install script excludes local env/tooling/node_modules and uses isolated Prisma generation. Archived tree8c7c2bb46c1240138429b70193d03fdbfc3fcba2 installed root/backend offline from cache; frontend277/backend547 tests, typechecks and builds all PASS. One subsequent cancel-button-only guard was verified by final workspace frontend rerun; installation/backend were not repeated for that attribute change. All raw logs and failed-attempt report retained under phase4-clean-install-* and phase4-reload-recovery-*.

No owner credentials/session files read, no existing DB changed, no live API/indexer started, no public financial transaction or signature. Backend/Rust/schema/dependencies unchanged; Postgres26 and contract/sandbox evidence retained from preceding checks, not rerun here. No new npm audit (prior backend0/frontend10low). User login report excluded; remote push blocker unchanged. Phase4/5 PARTIAL: independent README-only newcomer and actual wallet popup/cancel/reload/clipboard-denied branches/hosted CI remain NOT RUN; generative LLM integration incomplete. Clean source/cache install is not a different-machine online registry or signed-demo proof.
