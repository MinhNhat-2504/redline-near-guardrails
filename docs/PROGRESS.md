# Verified migration progress

Date: 2026-11-03 (UTC+7). Full handoff and supplied PDF read before implementation.

## Phase 0 — PASS (baseline import/build gate; open findings retained)

- Base commit: `aa0b0b044d9b6e01b71a14791ec68b24385e098b` from original REDLINE; full two-commit history retained.
- Final commit: `a6cabcb` (pushed to `origin/feat/near-mvp`).
- Files changed: `.gitignore`, `PROJECT_CONTEXT.md`, `scripts/scan-secrets.py`, this report, `BASELINE.md`, `NEAR_DECISIONS.md`, `NEAR_MIGRATION_PLAN.md`, `REUSED_COMPONENTS.md`, `evidence/`, supplied handoff/PDF.
- Inherited: all 359 original tracked files, no application source edits. New: migration documentation and scoped history scanner only.
- Commands/results: see `BASELINE.md` and real logs under `evidence/`. Frontend: 163/163 tests, typecheck/build PASS. Backend: 284/284 tests, typecheck/build PASS. Installs PASS. Initial sandbox frontend test attempt failed with spawn EPERM; unrestricted rerun passed.
- Security: pattern scan reviewed explicit TESTONLY fixture; npm audit frontend 6/backend 7 advisories. Not an independent security audit. License absent; unresolved before submission. Important inherited correctness/security findings recorded in `BASELINE.md`.
- NOT RUN: Solana LiteSVM, database/live API end-to-end, NEAR tests/builds at baseline. No lint script available.
- NEAR Testnet: NOT DEPLOYED; no account/transaction/receipt proofs.
- Secrets used: none; no `.env` created. Existing Git credential helper used only through Git, no secret values read or logged.
- Push verified: `git push origin main` succeeded, creating main on the NEAR origin. Original upstream unchanged. History scan exit 0 across 380 reachable blobs after exact TESTONLY fixture review; this does not claim exhaustive absence of secrets.
- Next: prepare Rust and implement/test Phase 1 in isolated crate. Dependency advisories and license clarification remain open work before public submission.

## Phase 1 — PASS (local contract/unit/sandbox gate)

- Base commit: `a6cabcb`.
- Final code commit: recorded by the commit named `feat(near-contract): enforce grants with pending ledger`; SHA added at the evidence checkpoint below.
- Files changed: isolated `contracts/near-safety-vault/` crate/lockfile/unit tests/sandbox harness/setup guide; `.cargo/config.toml`; `.github/workflows/near-contract.yml`; README migration banner; context, decisions, threat model, progress, test results, Testnet status and raw evidence. No inherited application or Anchor source edits; prior logs normalized to UTF-8 for review.
- New for NEAR: owner-isolated principal/storage ledger; immutable grants; seven gates plus caller/hash/amount/balance checks; pending amount/tx reservations before Promise; private idempotent transfer/withdraw callbacks; nonce/ID replay prevention; available-only withdrawals; events/views.
- Verified toolchain: Rust/Cargo 1.99.1, near-sdk 5.30.0, protocol 88, official sandbox 2.14.0-rc.5, Python cryptography 41.0.7. Cargo cache/target moved to isolated Linux `/tmp` for WSL performance; toolchain and setup diagnostics stay under ignored `.tooling/`.
- Commands and exact reproduction: `TEST_RESULTS.md`, `contracts/near-safety-vault/tests/README.md`.
- PASS: rustfmt check, Clippy all-targets with `-D warnings`, **21/21 SDK unit tests**, release WASM build with target cfg near, **actual local sandbox suite: 53 unique transactions / 136 receipt outcomes**. Five agent transfers SETTLED, each policy gate rejected as expected, native transfer failure released reservation, withdrawal settled and concurrent transfer/withdraw race preserved ledger. Expected negative runtime failures are distinguished from successful receipts containing policy REJECTED.
- PASS regression: frontend **163 tests + typecheck/build**; backend **284 tests + Prisma/TypeScript build**. Inherited Solana tests are not NEAR proof.
- Final sandbox-tested artifact SHA-256: `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524`. Actual local receipt data: `evidence/phase1-local-sandbox.json`; console result: `evidence/phase1-sandbox-verified.log`.
- Resolved failed attempts retained: protocol-86 host import mismatch; missing cfg near caused generic panic traps; expiry test incorrectly assumed height implied elapsed time; initial test-helper lifetime errors and needless-borrow lint. No failed attempt counted as PASS. See `TEST_RESULTS.md`.
- T01–T12: PASS in the documented SDK/local-runtime scopes. T13 indexer restart, T14 NEAR TypeScript conversions, T15 public Testnet demo: **NOT RUN**, belong to later phases. GitHub-hosted CI execution and independent audit: NOT RUN.
- NEAR Testnet: **NOT DEPLOYED**. A read-only public RPC status query verified protocol 88; no public account, deployment, transaction hash or explorer proof is claimed. Sandbox generated only local ephemeral keys under ignored `.tooling/`; no owner/Testnet secrets used.
- Review correction: intent storage is paid from the executor's own separately registered allowance; owner pays only grants/withdrawals. This prevents a compromised/revoked executor draining owner storage to block withdrawal. Payer isolation verified by SDK and actual runtime assertions.
- Open limitations: global grant ID squatting (use random IDs), non-refundable storage allowance/retention, direct owner calls only, pending state stays locked on lost callback. See `NEAR_THREAT_MODEL.md`.
- Next: **Phase 2 — BLOCKED at owner boundary**. Need dedicated Testnet contract/owner/executor/recipient account IDs, secure signing flow, and owner decision on contract deployment/upgrade-key custody. No mainnet, public visibility change or submission performed. See `TESTNET_PROOF.md`.
