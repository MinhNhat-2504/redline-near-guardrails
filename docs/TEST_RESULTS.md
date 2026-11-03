# Verified results — 2026-11-03 (UTC+7)

All PASS entries below were executed. SDK mock contexts, actual local NEAR receipts and public Testnet evidence are distinct classes. Phase 1 results below are historical; subsequent public deployment/init proof is recorded in `TESTNET_PROOF.md`. Public transfer/deny demo remains pending.

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
| T13 RPC/indexer restart | NOT RUN: NEAR backend/indexer not implemented (Phase 3) | No claim |
| T14 TypeScript yocto/timestamp conversion | NOT RUN: NEAR TS adapter absent. Rust JSON-string serialization tested, not a substitute | No claim |
| T15 public Testnet demo | NOT RUN: accounts/owner signatures required (Phase 2) | `TESTNET_PROOF.md` |

Additional PASS tests: storage allowance shortage, owner/executor storage payer separation, amount/hash validation, available balance isolation, arithmetic overflow, insufficient gas/liquid reserve, failed withdrawal release.

## Failed attempts retained (resolved, never counted as passing)

- Sandbox 2.13.4/protocol 86: failed contract initialization with unknown host import; `phase1-sandbox-protocol86-failure.json`, `phase1-sandbox-run.log`. Resolved by using Testnet-matched protocol 88.
- WASM without cfg near: named auth-error assertion encountered a generic unreachable trap; `phase1-sandbox-missing-near-cfg.json`, `phase1-sandbox88-run.log`. Resolved by target-specific build cfg and compile guard.
- Harness assumed height fast-forward implied expiry: assertion failed; `phase1-sandbox-clock-assumption.json`, `phase1-sandbox88-final.log`. Resolved by checking actual finalized chain time.
- Initial unit helper had seven temporary-reference lifetime compiler errors; `phase1-unit-final.log`. Corrected explicit reference types; final 21 tests PASS.
- Initial Clippy flagged needless borrow; `phase1-clippy.log`. Fixed; final warnings-as-errors run PASS.
- Early offline build lacked cached aws-lc-sys, and early Cargo jobs were stopped to move cache away from Windows filesystem. They are environment failures/interrupted attempts, not completed tests.

NOT RUN: GitHub-hosted CI execution, independent audit, cargo dependency advisory audit, live database/API E2E, public Testnet deployment. npm inherited advisories remain open as documented in `BASELINE.md`.
