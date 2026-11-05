# New installation, cancellation and reload checkpoint - 2026-11-05

Base commit `91b6fc1`. Phase4/5 remain PARTIAL. No wallet credential/session files, financial signing, deposits, public transactions, API server or indexer were used for this verification.

## Fixes and recovery boundaries

1. Startup previously awaited API health before restoring local pending intent/funding. Local recovery now runs first and independently of API availability. A valid saved intent selects its own grant ahead of stale remembered navigation, unless the URL explicitly selects a grant. Recovery never submits, creates a new ID, confirms funding or clears records.
2. Funding and intent restoration are independent: one corrupt record no longer hides the other. A blocked localStorage getter produces a visible recovery error instead of crashing during the grant-ID state initializer. Malformed/unreadable financial records block preparation/signing/submission, including Policy Lab handoff. Public analysis remains available after API connection. Existing synchronous checks are retained before wallet/financial actions.
3. Auth callback URL was previously erased before API verification. It is now removed only after successful verification. If the API fails, callback/challenge remain available for retry with the same signed message. The API connection retry button also retries a retained callback. Session responses must match the signing account and backend's43-character token format. No bearer is persisted for reload and no signature is added to localStorage.

   A lost verification response may mean the server already consumed the one-use challenge. A retry may correctly return401; a fresh sign-in is then required. Retaining the callback never bypasses challenge expiry/consumption and does not guarantee recovery of a lost session token.
4. Cancelling an unsigned review discards only the volatile proposal/deadline. The local cancel control is disabled while a wallet/API operation is in flight: cancelling local UI must not imply cancelling a request already opened in the wallet. After opening a funding wallet request, cancellation/closure without a verified hash remains ambiguous: retain the durable funding attempt and block replacement. No timeout unlock, automatic re-sign or new funding cancellation API was introduced. Existing multi-tab atomicity limitation remains.

## Tests and their limits

Ten new recovery tests cover empty first visit, exact restoration into a new page state, no-hash/hash funding retention, corrupt funding vs valid intent and vice versa, unavailable storage, stale grant metadata and failure to complete from an empty journal. Six wallet-transport tests cover API failure followed by same-callback retry, mismatched state/session, cancelled wallet connection and cancelled sign-in message. Wallet transport and browser globals in those tests are synthetic; they are not real browser wallet clicks.

Initial tests caught three old wallet fixtures returning `test-session` instead of the actual backend token shape. Fixtures now use a43-character TESTONLY value and reset queued API responses between cases; production validation was not weakened. The root failure log and failed isolated-install report are retained. Final root results:277 tests/34 files, typecheck and Vite build PASS (`phase4-reload-recovery-frontend-final.log`). Earlier intermediate271-test results cover recovery before the callback increment; they do not replace final results.

## Installation from isolated Git source

`scripts/check-near-clean-install.ps1` creates a unique ignored `.tooling/near-clean-install-*` directory from a Git commit/tree archive, with no `.git`, existing node_modules, local `.env`, backend `.env` or `.tooling` copied. It uses an empty npm user configuration and cache-only `npm ci --offline --no-audit --no-fund`, then checks/builds frontend and backend, including a fresh Prisma generate inside the isolated backend. It does not touch the existing backend's Prisma DLL, run migrations, start the API, load a wallet, or perform cleanup of existing project directories. Workspaces/logs are retained. Cache-only install is a developer check on this machine, not proof of a new machine's registry/network access.

Reproduce after committing the source, from the project root:

```powershell
.\scripts\check-near-clean-install.ps1 -Snapshot HEAD
```

Dependencies must already be in npm's cache. A missing package correctly fails; use ordinary README `npm ci` for an actual first online installation. No registry credential is needed for this cache-only check.

Installation source-tree ID and individual step results are recorded in `docs/evidence/phase4-clean-install-final-report.json`; copied logs use the `phase4-clean-install-final-*` prefix. PASS: frontend277 tests/typecheck/build, backend547 tests/typecheck/initial Prisma generation/build. The initial recovery-only archive and the subsequent fixture-failure archive are separately retained. After that archive run, the local cancel-button guard was added and the workspace frontend suite/typecheck/build rerun; no dependencies changed, so installation/backend checks were not repeated for that button-only change. A successful source install/build is not an independent newcomer walkthrough or proof of a running backend/browser session.

## Safe manual acceptance still needed

Keep the two existing PowerShell servers running. No new grant or funding is needed.

- After F5, any saved intent/funding should reappear. It must not be submitted automatically. The session remains memory-only, so protected reconciliation may require sign-in again.
- With backend stopped, F5 should still show saved local operations and API-unavailable status. Restart backend and use “Kiểm tra kết nối API”. Keep the same saved IDs; do not clear localStorage.
- Historical revoked-grant Policy Lab remains usable for public analysis despite a saved request. No new financial handoff should be enabled for REVOKED.
- Real wallet popup cancellation, browser redirect/reload during signing, auth callback API outage/retry and clipboard-denied behavior remain NOT RUN manually in this increment. Never deliberately create an ambiguous payment to test these branches without a reviewed owner-operated procedure.

An independent person following README through the entire signed demo, hosted CI, generative LLM migration and independent security audit remain incomplete. No source install/test result is substituted for those acceptance criteria.


Pre-commit: scoped Git history/index credential-pattern scan PASS1150 blobs/0 findings, exact inherited TESTONLY exception retained (phase4-reload-recovery-secret-scan.json). Staged whitespace PASS; user-modified login report excluded. Pattern scope only, not an independent credential audit. No remote push attempted.


2026-11-05 owner-observed reload acceptance: after F5, owner supplied browser screenshots showing the memory-only session signed out, the previous grant ID retained, and section3 automatically displaying the prior saved intent (nonce1/native NEAR/payee) without pressing the restore button. This confirms browser restoration/display for that saved record. The screenshots alone do not independently prove absence of a new chain transaction. Owner was instructed not to press submit/reconcile. Backend-unavailable reload and actual wallet cancellation remain unverified. Source unchanged; no tests/build rerun for this evidence-only note, no signature/funding/public RPC used.


2026-11-05 owner-observed backend-stopped reload follow-up: in response to instructions to stop only the backend and reload while Vite remains open, owner supplied section3 screenshot showing the same saved grant/intent JSON, nonce1, recipient and amount, with submit/reconcile disabled. This supports local restoration/display and disabled submission in that manual scenario. The screenshot does not independently establish backend process state, HTTP status or absence of new chain transactions; no additional RPC or financial action was performed. Next restore backend and retry API connection without submitting the saved intent. Actual wallet cancellation/redirect-retry, independent newcomer and hosted CI remain unverified. Docs-only update; tests/build not rerun.
