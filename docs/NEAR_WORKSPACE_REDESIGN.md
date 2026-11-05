# REDLINE NEAR workspace redesign - 2026-11-05

Base: `4b1626a`. Owner explicitly requested redesign and reuse of the original GitHub interface. The original repository, Git history, dashboard and assets were already present; no replacement clone, reset, public deployment or history rewrite was necessary. This is local source work, not publication through Sites.

## What was reused

- The existing `src/assets/redline-celestial-vault-hero.webp`, `redline-treasury-core.webp`, `redline-guardrails-citadel.webp` and `redline-evidence-observatory.webp`, also referenced by the original `ProtocolExperience.tsx`. No new generated/downloaded artwork.
- The inherited REDLINE navy/gold palette, Inter/JetBrains Mono typography, shield emblem, layered panel language and navigation patterns in `artifact-source.css`, `App.tsx` and the original overview.
- Existing lucide icons and React/Vite stack. No dependency or lockfile changes.

The original Solana dashboard at `/` remains intact and opens in a separate tab. The new NEAR shell does not mount its Solana wallet providers, simulate USDC balances, borrow Solana authority or call the old assistant's Solana endpoints. Attribution in README and Git history remains.

## User experience

The former long technical checklist at `/near` is now a workspace with seven direct-link views: `#/overview`, `#/vault`, `#/permissions`, `#/lab`, `#/activity`, `#/proofs`, `#/help`. Sidebar becomes a horizontal navigation strip on small screens. One React application owns wallet/session, pending operations and proposals while view wrappers hide inactive pages; changing views does not unmount that financial state. Browser back/forward and old NEAR anchor targets are handled; NEP413 callback fragments are not treated as app routes.

- **Overview:** original artwork hero, explicit read-only demo CTA, actual loaded vault/reservation metrics, revoked/expired permission state, state-driven next step and three original illustrated control cards. Unknown balances display a dash, never a fabricated zero/chart. Displayed metrics are the last loaded snapshot, not a claimed live feed; owner is shown when a grant is loaded.
- **Wallet & vault:** connected identity, native wallet account read, separate available principal/storage cards, clear initial-funding prerequisites and reasons why repeat initial principal is unavailable. No automatic funding or user key import.
- **Permissions:** existing grant lookup and snapshot, explicit new-permission budget/max-transactions/recipient, selected expiry and a visible explanation when preparation is unavailable. Grant input is locked while an operation/proposal is retained. A new grant cannot replace a saved intent before reconciliation; owner revocation remains separately reviewed.
- **Policy Lab:** existing same-block FINAL deterministic analysis remains unchanged. It can still analyze a historical grant without wallet authority. ALLOW handoff enters the Activity review panel, not submission. No generative LLM response is claimed.
- **Activity:** separate history with colored textual status badges, empty state links and retained full receipt hashes. Financial test cases are behind a deliberate disclosure; saved requests automatically expose their summary. JSON is optional under details, rather than the primary interface. Matching saved journal rows expose a separate read-only receipt-reconciliation button; sending/retrying the actual Testnet intent is explicitly labelled as a different action. A request with matching terminal FINAL evidence cannot be resubmitted through the visible button; completion preserves the journal.
- **Proofs:** nine actual historical browser receipts shown as filterable owner/settled/rejected cards, with exact Testnet links and a clear distinction between a successful transaction and a refused financial intent. Additional CLI/API proofs remain in TESTNET_PROOF.md; they are not the nine browser cards.
- **Help:** restart/setup instructions and explicit API check. Each successful check now reports its time, addressing the observed “nothing happened” feedback gap. Failed checks clear readiness until a subsequent verified health response.
- **Signature review:** dialog shows actual signer/receiver/deposit plus cap/recipient/expiry before the separate wallet action. JSON is collapsed. Keyboard focus is placed in the dialog and restored on close; Tab is bounded and Escape cancels only before an in-flight operation. Existing proposal validation is rerun before wallet invocation. Closing this unsigned review does not cancel an already-open wallet request.
- **Pending operations:** visible across all views; dedicated navigation returns to the same saved funding/intent, with no new ID, automatic submit or timeout unlock. Existing local recovery/error and authentication boundaries remain.

Clipboard denied/unavailable now exposes the exact attempted text for manual selection. In particular, copy-link failure previously showed only the hash; the fallback now displays the full URL. This path is unit-tested with synthetic permission failures, not yet manually exercised with browser permissions denied.

Wallet Selector and transaction SDK imports now load on demand for authentication/signing. Public proof review does not initialize a wallet. In the retained build logs, the NEAR page chunk dropped from620.88kB before splitting to approximately65kB after splitting; the roughly529kB wallet SDK chunk remains and triggers the existing size warning, but is deferred. These are minified artifact sizes, not a complete network/performance benchmark.

## Actual validation

- Frontend final:305 tests/35 files, typecheck and Vite build PASS (`phase4-workspace-frontend-final.log`), including all seven direct-route static renders, exact historical receipt links, unknown balances, status separation, authority facts in review and clipboard-denied fallback. These are unit/SSR tests, not interactive browser E2E.
- Backend:547 tests/39 files, typecheck and direct build PASS (`phase4-workspace-backend.log`). Backend source unchanged.
-26 actual isolated Postgres integration tests PASS (`phase4-workspace-postgres.log`); existing owner database untouched.
- Git-source/cache-only installation PASS for tree3843355f5c30b37a31970089a9f66654bdbd2452: fresh frontend/backend npm ci, initial isolated Prisma generation,304 frontend/547 backend tests, typechecks and builds. Logs/report under `phase4-workspace-clean-install-*`. The subsequent separate read-only receipt button, saved-intent-over-URL recovery guard and disabled-button reason refinements were checked with the final305-test workspace frontend suite/build; installation/backend were not repeated for that button-only change, which changes no dependencies.
- Contract/Rust/schema/dependencies unchanged; no contract redeploy, Rust/sandbox rerun, new chain transaction or wallet signature. Previous nine independent browser receipts remain historical proof.

The original hero image was visually inspected as a local asset. No controllable browser/visual preview tool was available for this session; actual desktop/mobile screenshots, keyboard interaction, dynamic navigation and wallet acceptance of the redesigned UI are NOT RUN. No passing visual review is inferred from build/SSR tests. The owner can open the existing local Vite installation to review; no hosting/deployment occurred.

## Remaining work and exact blockers

| Item | Current result | What remains |
|---|---|---|
| Product UI and navigation | New workspace implemented and local suites pass | Owner visual acceptance and actual responsive/browser interaction checks |
| Reload/offline/sign-in cancellation/copy-link | Prior owner-operated manual cases recorded; state/authority preserved in code | Repeat acceptance on redesigned layout; real denied-clipboard and auth redirect/outage branches |
| Full browser financial cancellation | Local ambiguity guards/tests exist | Deliberately interrupting a payment can create uncertain state; requires a reviewed owner-operated scenario, not automatic signing |
| Newcomer | Isolated source/cache installation and README paths exist | Independent person following README through fresh online installation and signed demo |
| Browser automation | Unit/SSR/security suites run locally | Browser automation/preview tooling is unavailable in this session; no invented E2E proof |
| Hosted CI | Dedicated NEAR workflows preserved, matching local tests pass | Remote push authentication remains blocked; no hosted run can be claimed |
| Generative copilot | NEAR rule-based explanations use real snapshots; original LLM code preserved | Provider configuration, read-only NEAR model integration and a real model response still required; no provider key read or paid inference made |
| Browser withdrawal | Contract/backend/CLI proof exist | Reviewed browser withdrawal and ambiguous-result recovery not implemented in this UI change |
| Security/dependencies | Prior backend audit0/frontend10low, no dependency change | Low wallet SDK advisories, full professional audit, multi-tab atomicity and callback-liveness limitations remain |
| Publication/submission | History, credits and raw proof docs remain | License/ownership confirmation, restored GitHub auth, public access/video/X/submission are owner/external actions |

Phase4/5 remain PARTIAL. A visual redesign is not proof all remaining financial/E2E/security requirements have passed. No promise of a hackathon prize or mainnet safety is made.


Final refinement: a saved intent grant now takes precedence over a conflicting grant URL, avoiding a recovery dead end behind the locked Grant ID input (one new regression test). Preparation-disabled hints include saved intent/proposal blockers. Final workspace frontend305 tests/35 files+typecheck/build PASS; isolated-install report retains its actual304-test snapshot from before this refinement. No dependency/backend/contract changes.


Pre-commit: staged whitespace PASS; reachable Git history/staged-index credential-pattern scan PASS1201 blobs/0 findings, inherited exact TESTONLY exception retained (phase4-workspace-secret-scan.json). Scan preceded the final mobile-only CSS refinement; no credential-bearing logic was added by that refinement. Final responsive CSS typecheck/Vite build PASS (phase4-workspace-build-final.log); logic tests were not repeated for the CSS-only change. User-modified phase3-owner-cli-login.json excluded. No remote push/deployment attempted.
