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
| Policy Lab and copilot | Same-block FINAL prediction; owner-observed REVOKED; opt-in read-only Gemini UI/adapter and local security tests now implemented | Owner provider/key/model configuration and real model response still NOT RUN; see NEAR_COPILOT_LLM.md |
| Native balance, own vault, history and receipts | Actual public account read, owner-observed balance/history/copy-hash | Copy-link/clipboard-denied browser acceptance and full history indexing not established |
| Pending/reload safety | Durable exact request restoration and matching FINAL completion tests; user screenshot confirmed pending request coexists with read-only analysis | Ambiguous no-hash funding must remain stopped for investigation; no automatic cancellation/reset/unlock. Multi-tab storage is not an atomic lock |
| Async financial safety | Prior21 SDK tests and53 real local sandbox transactions/136 receipts; real Testnet ALLOW/rejections/withdrawal | Callback-liveness and immutable-record growth remain documented operational limitations |
| Owner withdrawal | Contract/CLI proof retained; browser UI review, reload recovery and exact FINAL reconciliation now implemented and locally tested | Actual browser withdrawal NOT RUN; see NEAR_BROWSER_WITHDRAWAL.md |
| Newcomer reproduction | Owner waived independent newcomer acceptance on 2026-11-05; owner will assess usability | Removed from required acceptance, not a PASS; README/install evidence retained |
| CI | Dedicated NEAR workflow definitions exist; equivalent local suites pass | Hosted CI not executed; remote push auth remains unresolved |
| Dependencies | Backend0 findings, frontend10low | Wallet SDK advisory chain remains open; no clean overall audit claim |
| Submission | Provenance/history and proof docs preserved | Licensing confirmation, public repository access, demo video, X/submission remain owner/external work and are not published |

Priority next steps: test remaining read-only clipboard/reload behavior without signatures; validate newcomer setup in an isolated environment; then address the remaining demo/LLM scope explicitly. Any future change to custody, key scope, ambiguous funding disposition or financial recovery must respect owner approval and signature boundaries. Existing revoked demo grant need not be renewed or funded for those checks.


Pre-commit follow-up: staged whitespace PASS; Git reachable-history/staged-index credential-pattern scan PASS1116 blobs/0 findings (phase5-followup-secret-scan.json). Exact inherited TESTONLY fixture exception retained; no entropy/credential-validity audit implied. User-modified phase3-owner-cli-login.json excluded. No remote push attempted because the recorded authentication blocker has not changed.


## New installation and cancel/reload checkpoint - 2026-11-05

Base91b6fc1. Local pending/funding recovery now precedes API health, restores each record independently, handles blocked storage getter and selects a saved intent grant over stale navigation. Corrupt recovery blocks financial preparation/signing/submission but retains records and allows public reads when connected. Auth callback URL/challenge remain until successful verification; connection retry also retries that callback. Session identity/token shape checked. Local cancel disabled after wallet/API operation starts; no no-hash funding unlock or automatic re-sign introduced. See docs/NEAR_RELOAD_ACCEPTANCE.md.

Final workspace frontend277 tests/34 files+typecheck/Vite build PASS;16 new recovery/cancel/callback tests use synthetic storage/transport (not real browser wallet E2E). Initial3 test failures from old test-session fixture shape retained, then fixed to actual43-character token without weakening validation. Source-only cache-install script excludes local env/tooling/node_modules and uses isolated Prisma generation. Archived tree8c7c2bb46c1240138429b70193d03fdbfc3fcba2 installed root/backend offline from cache; frontend277/backend547 tests, typechecks and builds all PASS. One subsequent cancel-button-only guard was verified by final workspace frontend rerun; installation/backend were not repeated for that attribute change. All raw logs and failed-attempt report retained under phase4-clean-install-* and phase4-reload-recovery-*.

No owner credentials/session files read, no existing DB changed, no live API/indexer started, no public financial transaction or signature. Backend/Rust/schema/dependencies unchanged; Postgres26 and contract/sandbox evidence retained from preceding checks, not rerun here. No new npm audit (prior backend0/frontend10low). User login report excluded; remote push blocker unchanged. Phase4/5 PARTIAL: independent README-only newcomer and actual wallet popup/cancel/reload/clipboard-denied branches/hosted CI remain NOT RUN; generative LLM integration incomplete. Clean source/cache install is not a different-machine online registry or signed-demo proof.


2026-11-05 owner-observed sign-in message cancellation: owner confirmed choosing Cancel in the Intear sign-message popup, and supplied the popup plus resulting REDLINE screenshots. Page remains not authenticated; login button is enabled and no in-flight indicator is visible. Mark this specific real-browser manual sign-in-message cancellation case PASS (owner-observed). This does not establish cancellation of a financial transaction, connection-prompt cancellation, or auth callback outage/retry. No new token, signature verification, RPC receipt or financial submission was independently captured. Source unchanged; no tests/build rerun for this evidence-only update. Next optional manual check: repeat sign-in after cancellation, approve sign-in message only, preserving the existing financial request.


2026-11-05 owner-observed login after cancellation: following the earlier Cancel test, owner supplied screenshot showing authenticated nhat-redline-web.testnet with logout available, original grant retained and saved-intent guidance still present. This specific manual cancel-then-login sequence is PASS (owner-observed), not independent capture of the signed message/session. No financial signature or transfer is inferred. Next acceptance: load original grant journal, reconcile the historical matching receipt through track (read-only chain observation), then allow local completion only if existing FINAL event matches saved request. Never use transfer-submit as a substitute for this read-only check. Source unchanged; no tests/build rerun.


2026-11-05 owner-observed terminal local completion: after guidance to load the same grant, reconcile the matching historical receipt and finish the local case, owner screenshot shows section3 no longer displaying a saved intent, with case preparation controls enabled; section4 retains the matching historical REJECTED/REVOKED row and FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP receipt. This confirms the visible local-completion outcome in that manual sequence. Screenshot alone does not independently show each intervening click, localStorage deletion, or absence of additional chain transactions. No new receipt verification or public submission performed by agent. Historical journal retained. Source unchanged, tests/build not rerun. Next safe manual check: copy Testnet receipt link and inspect its exact URL without signing.


2026-11-05 owner-observed receipt copy-link acceptance: owner used the REVOKED row copy-link control and pasted https://explorer.testnet.near.org/transactions/FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP. Exact URL matches the fixed Testnet Explorer domain/path and previously independently verified historical rejection hash. Copy-link manual acceptance PASS for this browser; no fresh explorer/RPC lookup or new transaction proof claimed. Clipboard-denied fallback remains unverified in a real browser.

Current manual scope now includes: normal reload restoration, reported backend-stopped reload retaining request with submission disabled, sign-in message cancellation, successful login after cancellation, visible local completion of the historical terminal request, and exact receipt copy-link. These owner observations supersede earlier blanket pending language only for those cases. Financial popup cancellation, auth redirect/API-outage retry, independent README-only newcomer, hosted CI, generative LLM and independent audit remain outstanding. Source unchanged; no tests/build rerun for this docs-only update. No further wallet signatures or funding required for remaining read-only checks.


2026-11-05 workspace redesign: original REDLINE palette/typography/shield/navigation patterns and four existing illustrations reused directly in a new NEAR-only workspace. Sidebar routes: overview/vault/permissions/lab/activity/proofs/help; same app retains financial state while views hide. Human-readable review dialog preserves signer/receiver/deposit/cap/recipient/expiry and the separate wallet signature. Unknown metrics remain unknown, pending operations visible globally, disabled creation explained, new grant blocked during saved intent. Activity has separate read-only receipt observation vs explicit financial send/retry; terminal FINAL requests cannot be resubmitted by the visible button. Nine historical browser receipts have filters and exact Testnet links. Copy denied exposes exact attempted hash/URL; synthetic tests cover fallback. Wallet/transaction SDK imports deferred; NEAR page artifact approximately65kB, deferred wallet529kB (existing size warning retained). Original Solana app/providers/source preserved and not mounted by NEAR. No clone/reset/history rewrite, new dependencies, key/credential reads, signature or public transfer. UI work is now owner-authorized; previous deferral superseded. Full scope/remaining acceptance: docs/NEAR_WORKSPACE_REDESIGN.md.

Checks PASS: frontend305 tests/35 files+typecheck/Vite build; backend547 tests/39 files+typecheck/direct build;26 actual isolated Postgres integration tests. Source-only Git tree3843355f5c30b37a31970089a9f66654bdbd2452 cache installation/Prisma generation/frontend304/backend547/builds PASS; final separate-receipt-button refinement rechecked by workspace frontend suite/build without repeating unchanged dependency installation/backend. Logs phase4-workspace-*. No controllable browser preview tool available; visual desktop/mobile/interactive dialog acceptance NOT RUN and not inferred from SSR. Prior manual walkthrough validates earlier layout, not automatic acceptance of the redesign. Backend/contract/schema unchanged; Rust/sandbox/audits not rerun (prior backend0/frontend10low). Phase4/5 PARTIAL; actual automated browser, fresh online independent newcomer, generative LLM/provider, browser withdrawal, GitHub CI/auth, license/public-submission work remain outstanding.


## 2026-11-05 — Browser withdrawal implementation and acceptance scope

Owner removed independent newcomer testing from required acceptance and will assess usability personally. Recorded as WAIVED, not PASS; original reproduction evidence retained.

Implemented principal-only withdrawal in Ví & quỹ, separate human review and owner wallet signature, exact amount/ID/owner validation, fresh available balance before signing, durable public attempt before wallet opens, independent reload restoration, no replacement after timeout/cancellation, authenticated exact FINAL callback/receipt/stored-view reconciliation. A failed receipt cannot establish SETTLED. Same saved withdrawal/hash retained until verified terminal callback; no timeout unlock or automatic resend. Current-owner balance refreshes after confirmed outcome; unrelated historical intent rows retained.

Verified frontend342 tests/36 files + typecheck/Vite build PASS; backend561 tests/40 files + typecheck/direct tsc build PASS;26 actual isolated Postgres tests PASS. Evidence: phase4-withdrawal-frontend.log, phase4-withdrawal-frontend-final.log, phase4-withdrawal-backend.log, phase4-withdrawal-postgres.log. Backend typecheck/direct build also executed successfully via tool transcript.37 frontend and14 backend new cases are local/synthetic, with regression against archived Phase2 CLI receipt, not a new browser proof. No new Rust/schema/dependency changes, keys/session reads, wallet signatures, financial submissions or deposits. Existing wallet chunk warning remains. Guide: docs/NEAR_BROWSER_WITHDRAWAL.md.

Phase4/5 remain PARTIAL. Actual redesigned browser/mobile/withdrawal acceptance, generative NEAR copilot and configured provider/real response, hosted GitHub CI/auth remain open. No browser automation tool available; no provider/paid model call made. Independent newcomer is no longer a required gate. Remote push blocker unchanged; user-modified login evidence excluded from staging.


## 2026-11-05 — Opt-in NEAR generative copilot implementation

Added dedicated Gemini adapter, authenticated owner-only explain route and UI in Policy Lab after deterministic analysis. Re-reads a pinned FINAL snapshot; sends only deidentified amount/nonce/limits/accounting/gates. Separate immutable evaluator verdict/provenance from advisory model text. No wallet/transaction/DB write interface in model service; no model-to-intent handoff; React text escaping, explicit user data/cost consent. Fixed Gemini host/header-only key/no redirects/no retries, timeout15s/output1200tokens/response32KiB, strict output schema, thought-text/signature filtering. Disabled by default; requires explicit server GEMINI_API_KEY/NEAR_COPILOT_MODEL/NEAR_COPILOT_ENABLED. No legacy masked-key logging or model fallback. Process quotas3/minute/owner and20/hour, one in-flight request; not durable/multi-replica billing quotas. Expired model-route sessions clear visible login identity while preserving saved financial operations.

PASS: frontend357 tests/37 files + typecheck/Vite build; backend589 tests/41 files + typecheck/direct tsc build;26 real isolated Postgres tests.15 new frontend and28 backend cases use synthetic model/RPC transport and do not prove actual provider/model access. Initial full run356/588 preceded extra thought/text-escaping cases; final counts357/589 are separate logs. Evidence phase5-copilot-frontend-final.log, phase5-copilot-backend-final.log, phase5-copilot-postgres.log; initial runs retained. CSS-only checkbox refinement built separately after these logic checks.

No API keys/.env/session/executor credentials read, no real inference or paid provider call, no financial signature/submission/funding, no new dependencies/schema/contract changes. Source protocol references verified against official Gemini documentation, but actual model compatibility/latency/answer remains NOT RUN. Setup and data/billing boundaries: docs/NEAR_COPILOT_LLM.md. Owner must configure provider/model/key locally and accept egress/cost before the live check. Actual browser/mobile/withdrawal/LLM acceptance remains outstanding; Phase4/5 PARTIAL. Independent newcomer requirement stays waived. Hosted CI/push remains blocked by recorded GitHub auth; user login evidence untouched. No remote push attempted.


## 2026-11-05 — First owner copilot attempt and safe diagnostics

Owner screenshots show enabled Gemini/gemini-3.8-flash status, logged-in nhat-redline-web.testnet, revoked historical grant and REVOKED prediction, then consented AI click returning generic API503. This establishes an owner-observed failed request, not successful model acceptance. Cause unknown: old UI masked RPC/provider/parse failures into the same message. No root cause inferred from screenshot, and no raw response/keys captured.

Added fixed-code error classification for snapshot/provider HTTP/key/access/model/quota/request rejection/network/timeout/truncated/blocked/invalid response; no raw provider text or metadata reflected. Frontend only accepts recognized codes from copilot503, preserving bearer session and existing financial error behavior. HTTP400 intentionally remains ambiguous. No retries, token-budget/model/permission/billing changes, .env reads or live calls by agent. Owner restarts backend before collecting the next code.

Checks PASS: frontend362 tests/37files + typecheck/Vite build; backend599 tests/41files + typecheck/direct tsc build. Evidence phase5-copilot-diagnostics-frontend.log and phase5-copilot-diagnostics-backend.log.10 backend and5 frontend new synthetic tests cover classification, sanitization, unknown/prototype codes and financial-route isolation. Postgres/Rust/audit not rerun: no schema/contract/dependency changes, prior26 DB tests retained. Existing wallet chunk warning and GitHub auth blocker remain. Phase4/5 PARTIAL; actual successful LLM response still unverified. User login report excluded.


## 2026-11-05 — Repeated copilot sign-in rejection and HMR/session handshake fix

Owner reported immediate login rejection after re-login twice, with screenshots showing the expired/invalid-session banner and the Policy Lab reset. Actual bearer-header/session-DB/key failure is not independently captured, so ordinary30-minute expiry is not an established explanation. Audited cached lazy wallet vs HMR-reloaded API closure: old per-module token primitive could split authenticated UI from the API client used by copilot. Added a shared token/revision object through Vite hot.data (RAM only, no local/session storage/global persistent token), verified /auth/me account+future expiry before both normal and callback login UI success, explicit missing-local-token failure, and late401 handling that preserves a newer login. No auth bypass, changed session lifetime or weakened on-chain FullAccess verification.

Verification PASS: frontend373 tests/38files + typecheck/Vite build; backend599 tests/41files + typecheck/direct build. Eleven new frontend synthetic cases cover shared old/new closures, fresh tab/page isolation, invalid memory, protected handshake identity/expiry/missing token and late401. Initial typecheck failed on zero-argument mock tuple typing; fixed only test signature and reran (logs retained). Intermediate372-test run preceded the final missing-bearer case. Final evidence: phase4-auth-hmr-frontend-complete.log, phase4-auth-hmr-backend.log. Backend source unchanged; DB/Rust/audit not rerun, previous26 Postgres evidence retained. No existing .env/key/session files read, provider call, owner signature, financial broadcast or DB write by agent.

Owner browser acceptance remains pending: F5 once to discard pre-fix module closures, sign in and observe the new API handshake before trying copilot again. This is a source-level fix and synthetic regression result, not proof that HMR caused the particular browser failure or that Gemini now succeeds. Phase4/5 PARTIAL, GitHub auth blocker and user login evidence unchanged.
