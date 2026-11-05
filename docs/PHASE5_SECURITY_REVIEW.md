# Phase 5 security review — 2026-11-04

Status: **PARTIAL**, Testnet prototype only. This is an implementation review and regression run by the coding agent, not an independent security audit. Base: `c914062`. No owner signatures, private credentials, public financial submissions, deployment or database schema changes were used.

## Findings and disposition

| ID | Finding | Disposition |
|---|---|---|
| SEC-01 | Old Fastify/Vite/Vitest and compatible transitive dependencies have npm advisories | Patched within existing major versions: Fastify5.12.8, Vite6.4.5, Vitest4.1.12, compatible fast-uri/source-map-js/browserslist/baseline-browser-mapping updates. Lockfiles retained. No force upgrade. |
| SEC-02 | Authentication responses and FINAL snapshots lacked explicit HTTP no-store | Added `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` to NEAR API responses, including errors. Regression tests cover both. |
| SEC-03 | CI backend token permission was implicit; fixture changes did not trigger its checks | Explicit contents:read,20-minute timeout and browser-proof fixture path filter added. Hosted execution NOT RUN. |
| SEC-04 | Zod3.25.76 high advisory remains | OPEN. npm reports GHSA-mrhx-c7xc-m3w5 (oversized constrained collection memory exhaustion), fix4.6.7 is a major migration. See [reviewable proposal](NEAR_ZOD4_MIGRATION_PROPOSAL.md). NEAR's32KiB body limit reduces request size, but is not proof the advisory is eliminated. Do not claim a clean dependency audit. |
| SEC-05 | Wallet SDK transitive low advisories remain | OPEN:10 frontend low findings, including elliptic/secp256k1 dependency propagation. Current auth accepts Ed25519 only; other browser wallet SDK paths are not thereby certified safe. No blind downgrade to wallet-selector9 or transactions1. |
| SEC-06 | Prior README/threat/demo status understated completed browser proof | Corrected docs to distinguish owner-observed UI operation, independently verified nine financial transactions and automated offline regressions. Full Phase4 remains PARTIAL. |

Audit totals: frontend16 (3high/3moderate/10low) → **10low**; backend7 (5high/2moderate) → **1high**. All have0critical. `npm audit` still exits1; this is not a passing vulnerability gate. Raw before/intermediate/final JSON reports: `docs/evidence/phase5-*-audit*.json`.

The Fastify update changed its default error generic to unknown. Initial typecheck failed and is retained in `phase5-backend-typecheck-initial-failure.log`; explicit FastifyError type arguments resolved it. The legacy server has only this type-level import/generic change, with no business-logic edit; its previous verbatim source remains in Git (`101d667a6b9143fc497fa58bc2c230b28486b5f8`).

## Threat boundaries reviewed

| Threat | Source/control | Verified scope |
|---|---|---|
| Async cap/slot race, withdrawals vs pending | Contract reserves amount/slot before Promise; separate pending withdrawals |21 SDK unit tests and real local sandbox rerun; public ALLOW receipt proof separate |
| External/double callback, failed Promise | Private self-callback, exactly one result, only PENDING transitions; failure releases once | SDK plus actual local sandbox failed receipts/callbacks; no new Testnet failures deliberately submitted |
| RPC timeout/optimistic return fabricated as settled | Production receipt parser requires FINAL, exact identity/return/vault event; failed receipt cannot establish SETTLED | New saved-browser-proof mutations; existing restart/budget tests |
| Removed/wrong FullAccess key and challenge replay | NEP-413 callback/recipient/client binding; FINAL key lookup; atomic challenge consumption; hashed sessions | Real SDK signatures + isolated Postgres with mocked chain ownership; real wallet login owner-observed |
| API-key fallback, foreign origin, oversized body | Dedicated NEAR session boundary, strict schemas, origin guard,32KiB body limit | Injected HTTP tests; chain side effects not reached when unauthorized |
| Multi-owner journal/revoke | Owner checked before journal query and revoke proposal | New injected HTTP tests; contract owner isolation in SDK/sandbox; existing real-DB request binding |
| Scoped executor/key replacement | Exact receiver/method/finite allowance, persisted packet checked before replay | Real isolated-DB/SDK tests and prior actual installed-key/reset/API proofs |
| Browser funding/request ambiguity | Persist expected public request before signing; no timeout unlock; FINAL exact receipt/newer-block reconciliation | Frontend negative tests, real funding receipts and owner-observed walkthrough. Multi-tab storage is not an atomic lock. |
| Secret disclosure | Header redaction, no raw internal errors, no credential read by proof helpers; scoped history/index pattern scan | HTTP synthetic failure test; scan report attached separately. This is not an entropy/credential validity audit. |

## Commands and actual results

| Command/environment | Actual result | Evidence |
|---|---|---|
| Root `npm.cmd run check`, Windows Node24.14.1 | PASS221 tests/29 files, typecheck, Vite build | phase5-frontend-checks-final.log |
| Backend `npm.cmd run typecheck`, `npm.cmd test`, `npx.cmd tsc -p tsconfig.json` | PASS448 tests/36 files and direct build | phase5-backend-checks-final.log |
| Backend `scripts/test-near-db.ps1` | PASS25 real isolated Postgres tests; disposable container cleaned up | phase5-postgres-final.log |
| WSL `CARGO_NET_OFFLINE=true ... scripts/verify-near-local-security.sh` | PASS fmt/21 SDK tests/Clippy/WASM/real sandbox53 transactions,136 receipts | phase5-contract-security.log; phase5-local-sandbox.json |
| npm audit frontend/backend | FAIL exit1, remaining10low/1high respectively | phase5-frontend-audit-final.json; phase5-backend-audit-final.json |
| Hosted CI / automated real-wallet browser E2E / independent audit | NOT RUN | No claim inferred from local tests or workflow YAML |

Rebuilt WASM SHA256 remains `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524`; no contract redeploy needed. Backend compilation intentionally uses direct tsc to avoid regenerating Prisma's DLL while the user's existing backend may be open. Unit tests use real saved browser RPC receipts offline plus clearly synthetic mutations; they create no new chain proofs. Local sandbox credentials are generated test keys, not public account keys.

No new critical policy-spend bypass was identified in this bounded review. This is not a guarantee that none exists. Zod advisory, SDK low findings, callback-liveness recovery, unbounded immutable record growth, operator FullAccess upgrade power, bounded direct-call discovery, unaudited browser transport/XSS surface and missing hosted/browser automation remain open.

## Phase 4 requirements still open

1. README-only newcomer reproduction without interactive coding-agent guidance has not been validated. Read-only inspection and a manual signed walkthrough are available; there is no unattended one-click financial demo.
2. Existing Solana dashboard/risk copilot/Policy Lab remain preserved at `/`; their policies are not wired into the NEAR signing path. Never present their mock/Solana decisions as NEAR evidence.
3. `/near` is explicitly Testnet-only and rejects mainnet. A complete network/navigation switch and real native wallet-account balance display (distinct from vault principal/storage) remain incomplete.
4. Receipt/link/copy usability, clear setup prerequisites and recovery instructions need functional completion before UI polish. Actual browser FAILED/cancel/reload financial behavior is not established by the successful run.

Next: review the Zod major migration before changing shared input validation, then complete the remaining guided-flow requirements. No new owner signature or principal funding is needed for the current security checkpoint. Remote push remains unavailable until the owner restores GitHub authentication; local commits are not remote synchronization.

Sources checked 2026-11-04: [NEAR private callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks), [access key permissions](https://docs.near.org/protocol/accounts-contracts/access-keys), [NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md), [Fastify maintainer advisory](https://github.com/fastify/fastify/security/advisories/GHSA-mg2h-6x62-wpwc). Current package findings/fix metadata are the saved npm audit output; attempted maintainer URLs for the Vite/Zod advisories returned404, so no successful primary-source retrieval of those pages is claimed.

- Phase5 pre-commit verification: staged whitespace PASS; scoped Git history/index credential-pattern scan PASS, 1004 blobs,0 findings; exact inherited TESTONLY fixture exception retained. Raw report phase5-secret-scan.json. Pattern scope only, no entropy/credential audit claim. User-modified phase3-owner-cli-login.json not staged.

## Superseding checkpoint: approved Zod4 migration — 2026-11-04

Owner approved and implementation completed; Zod4.6.7 migration PASS.57 captured before/after cases preserve acceptance and valid outputs; three native malformed-decimal exceptions now controlled rejection. Backend509 tests/37 files+typecheck/direct build,25 real isolated Postgres tests, frontend221 tests/29 files+typecheck/build PASS. Backend npm audit now0 findings/exit0, frontend10low/exit1. Original high-Zod finding is RESOLVED; historical rows above record its prior state. No security exception, wallet operation or contract change. Current evidence and limitations: [Zod4 migration results](ZOD4_MIGRATION_RESULTS.md). Overall Phase4/5 remain PARTIAL for documented integration/newcomer/hosted/browser automation work; no new approval required for the already-approved migration.

## Onboarding follow-up — 2026-11-04

Native account balance, next-step/restart guidance, proof-only path, owner funding journal and copy hash/link controls are now implemented with frontend228/backend517/Postgres26 passing tests. NEAR/legacy navigation is explicit; Mainnet remains unsupported. Earlier gaps for those functions are superseded; full live/newcomer/clipboard acceptance is still pending, and legacy PolicyLab/copilot are not connected to NEAR signing. See NEAR_ONBOARDING_CHECKPOINT.md for evidence and remaining scope. No new owner signature or funding was used.


## Functional/security follow-up - 2026-11-05

Base da74fa0. Exact requested grant deadline now bound before proposal display and again before wallet opening; canonical u64 and boolean unsigned checks added. Hours selector locked during proposal review. No observed unauthorized transfer; this closes proposal-substitution ambiguity without changing owner signing or executor scope. Added offline/injected tests for ALLOW not authorizing transfers, no session leakage, origin/body/content-type/override boundaries, local rate limit and duplicate intent. Details and acceptance matrix: docs/NEAR_FUNCTIONAL_SECURITY_CHECKPOINT.md.

Actual results: frontend261 tests/32 files+typecheck/Vite build PASS; backend547 tests/39 files+typecheck/direct build PASS;26 REAL isolated Postgres tests PASS. npm audit backend0/exit0; frontend10low/exit1, zero moderate/high/critical. No package upgrades; no contract/schema changes or new Rust/sandbox run. Logs/reports phase5-followup-*. Existing user DB/login report preserved; no wallet signatures, secrets/session reads or public financial submissions.

Phase4/5 remain PARTIAL. Policy Lab read-only browser acceptance already owner-observed; generative LLM migration, independent newcomer/fresh-clone acceptance, clipboard-denied/cancel/reload browser coverage and hosted CI remain incomplete. Browser withdrawal UI is not implemented (contract/backend/CLI proof exist). No ambiguous funding unlock or cross-tab atomicity is claimed. Remote push auth and license/public-submission owner work remain unresolved. Next safe work is read-only recovery/clipboard/newcomer verification before UI redesign.


## New installation and cancel/reload checkpoint - 2026-11-05

Base91b6fc1. Local pending/funding recovery now precedes API health, restores each record independently, handles blocked storage getter and selects a saved intent grant over stale navigation. Corrupt recovery blocks financial preparation/signing/submission but retains records and allows public reads when connected. Auth callback URL/challenge remain until successful verification; connection retry also retries that callback. Session identity/token shape checked. Local cancel disabled after wallet/API operation starts; no no-hash funding unlock or automatic re-sign introduced. See docs/NEAR_RELOAD_ACCEPTANCE.md.

Final workspace frontend277 tests/34 files+typecheck/Vite build PASS;16 new recovery/cancel/callback tests use synthetic storage/transport (not real browser wallet E2E). Initial3 test failures from old test-session fixture shape retained, then fixed to actual43-character token without weakening validation. Source-only cache-install script excludes local env/tooling/node_modules and uses isolated Prisma generation. Archived tree8c7c2bb46c1240138429b70193d03fdbfc3fcba2 installed root/backend offline from cache; frontend277/backend547 tests, typechecks and builds all PASS. One subsequent cancel-button-only guard was verified by final workspace frontend rerun; installation/backend were not repeated for that attribute change. All raw logs and failed-attempt report retained under phase4-clean-install-* and phase4-reload-recovery-*.

No owner credentials/session files read, no existing DB changed, no live API/indexer started, no public financial transaction or signature. Backend/Rust/schema/dependencies unchanged; Postgres26 and contract/sandbox evidence retained from preceding checks, not rerun here. No new npm audit (prior backend0/frontend10low). User login report excluded; remote push blocker unchanged. Phase4/5 PARTIAL: independent README-only newcomer and actual wallet popup/cancel/reload/clipboard-denied branches/hosted CI remain NOT RUN; generative LLM integration incomplete. Clean source/cache install is not a different-machine online registry or signed-demo proof.
