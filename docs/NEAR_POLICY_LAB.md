# NEAR Policy Lab / rule-based copilot

Implemented 2026-11-04, base commit42dd156. Phase4/5 remain PARTIAL. Cosmetic UI redesign is deferred.

The NEAR page now has its own Policy Lab. The original Solana Policy Lab, USDC simulation and LLM assistant routes remain preserved; they are not connected to NEAR authority. This increment provides deterministic explanations from actual NEAR state, not a migrated generative LLM or autonomous agent.

## Data and authority

`POST /near/policy-lab/analyze` is public and read-only. Strict input contains grantId, exact yocto amount, recipient, u64 nonce, asset, policyHash, and optional existing intentId. It accepts no owner-supplied policy override. The service reads a FINAL block header, then pins grant, the grant owner's ledger and optional duplicate-intent lookup to that block hash. Response height/hash must match. It uses block nanoseconds, not the browser clock. The `block_id` query follows [official NEAR RPC documentation](https://docs.near.org/api/rpc/contracts).

Gate precedence follows `contracts/near-safety-vault/src/lib.rs::evaluate`: active, expiry, replay, asset, recipient, count including pending, cap including pending, cooldown, policy hash, positive amount, available principal including pending withdrawals. Later gates are NOT_EVALUATED after the first block. Exact BigInt arithmetic preserves u64/u128 precision. It creates no reservations, sessions, signed packets, DB rows or transactions. RPC failures and inconsistent snapshots produce errors, never ALLOW.

ALLOW means only that these policy checks passed at the displayed snapshot. Executor caller/key authority, gas, executor storage, dispatch/callback success and subsequent state changes are not predicted. Only actual finalized receipts/callback state prove settlement. The existing on-chain evaluator remains authoritative.

The browser can analyze a revoked historical grant without signing or funding. An ALLOW candidate owned by the signed-in account can be moved to the existing review panel: native NEAR, reviewed payee, amount at most the existing demo cap0.05, matching nonce/hash, no reused intent ID. A fresh ID is durably persisted through the existing pending-request mechanism. This action does not send. Existing request/funding/proposal blockers remain; subsequent submission uses the existing authenticated scoped executor path and matching grant checks. New grants still require separate owner review/signature. Neither copilot nor model can widen a policy or sign owner actions.

## Try without another transaction

1. Restart only the backend window: Ctrl+C, then run `backend/scripts/start-near-local.ps1` from the backend directory. Keep Vite at localhost5173.
2. Open `/near`, choose the historical revoked demo grant and click “Đọc snapshot FINAL”. Login is optional for analysis.
3. Open “Policy Lab / Copilot NEAR”, leave0.01 NEAR and click “Phân tích · chỉ đọc”. Expect REVOKED for this historical grant; later gates are not evaluated. There is no need to create a new grant, fund or reset a key.
4. Optional: enter an existing intent ID to include the duplicate lookup. A revoked grant still reports REVOKED first, matching contract precedence.

Public reproduction, with a new output path:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/read-near-policy-lab.ts grant-1b031438090c4fa1902eb9ddcbd1f47c ..\docs\evidence\my-policy-lab-read.json
```

## Verified evidence

- Frontend:249 tests/32 files, typecheck and Vite build PASS (`phase4-policy-lab-frontend.log`). Vitest now discovers `.test.tsx` as well as `.test.ts`; previously the new TSX tests were not discovered. Final count includes them.
- Backend:543 tests/39 files, typecheck and direct tsc build PASS (`phase4-policy-lab-backend.log`). Includes gate boundary/order, invalid data, pinned RPC mismatch, read-only injected route and authority-free dependency tests.
-26 real disposable Postgres integration tests PASS (`phase4-policy-lab-postgres.log`), unchanged schema and existing DB untouched.
- Standalone read helper strict typecheck PASS (`phase4-policy-lab-helper-typecheck.log`, empty on success).
- Actual public RPC read PASS at FINAL block276166710/hashFTCMrfaDXzyGuVEnchcuM2eSH3GgLKMMXyJHDpKgMyzH: historical grant revoked, principal0.09/storage0.04498, predicted REVOKED. Captured timestamp2026-11-04T07:54:27.086Z; `phase4-policy-lab-public-snapshot.json` and `phase4-policy-lab-public-read.log`. This is public state and a prediction, not a new transaction proof.

Browser click acceptance of these new controls is NOT RUN. Tests cover rendering and pure handoff boundaries, not an automated wallet browser walkthrough. No generative LLM migration, multi-step future simulation, new live ALLOW transfer, fresh-clone acceptance or hosted CI result is claimed. Existing contract and nine independently verified browser transactions are unchanged; Rust/sandbox not rerun for this increment. No dependency changes or new dependency audit in this increment. Existing frontend low advisories, public RPC rate limits and bundle-size warning remain.


2026-11-05 finalization: reviewed retained November4 checks and public read evidence without rerunning unchanged source. Credential-pattern scan of Git history/staged index PASS:1091 blobs/0 findings, exact inherited TESTONLY fixture exception retained (docs/evidence/phase4-policy-lab-secret-scan.json). This is a pattern scan, not an independent credential audit. Staged whitespace PASS; user-modified phase3-owner-cli-login.json excluded. No remote push or public transaction performed. Next: manual read-only Policy Lab browser acceptance; Phase4/5 remain PARTIAL.


2026-11-05 read-only lock fix (base d56118c): owner screenshot exposed saved intent disabling Policy Lab analysis. Split the read-only availability guard from reviewBlocked (pending request/funding/proposal). Existing durable records, grant selection lock and new-intent/signing blockers remain intact; no deletion or resubmission. Added visible explanation and SSR regression for enabled analysis with a saved request. Frontend250 tests/32 files, typecheck and Vite build PASS (docs/evidence/phase4-policy-lab-readonly-unlock.log). Backend/DB/contract unchanged and not rerun; no public RPC or financial transaction for this fix. Manual browser confirmation pending. Phase4/5 remain PARTIAL.
