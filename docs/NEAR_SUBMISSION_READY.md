# REDLINE — release and submission handoff

Prepared 2026-11-12 (Vietnam time). Target submission: 2026-11-13. This is a release checklist, not a claim that every migration acceptance item is complete.

## What the product demonstrates

REDLINE lets an owner delegate bounded native-NEAR spending to an executor: budget, approved recipients, count, expiry, cooldown and replay protection. The owner reviews and signs permissions; the NEAR contract enforces them. An optional Gemini panel explains rule results and cannot sign or bypass policy.

The public repository preserves the original Solana history and separates the new NEAR work. Actual historical Testnet receipts cover allowed payment, cap/recipient/replay rejections, revoke, post-revoke rejection and withdrawal. The guided demo presents those existing records, not a freshly running autonomous purchasing agent.

## Product release scope

| Item | State |
| --- | --- |
| Core Testnet contract, scoped executor, login and accounting | Prior independent proof, with exact scope in README and evidence files |
| Browser withdrawal and settled balance | Prior FINAL receipt/callback/view verification; completed-reload owner observation |
| Vietnamese first-visit explanation, four-case evidence tour | Implemented, local render tests; actual current desktop/mobile acceptance still needed |
| English guided evidence tour | Implemented; English covers the tour and architecture disclosure, not the entire operational workspace |
| No-wallet / no-backend evidence path | Links and case content are local frontend presentation; live API features remain unavailable until connected |
| Optional Gemini | One owner-observed response; repeated HTTP503 failures. Circuit/cooldown/error presentation implemented; no reliability guarantee |
| License, source attribution, public main | Verified at prior publication checkpoint; personally owned NEAR work MIT, inherited scope explicit |
| Fresh-clone installation / DB / contract tests | Prior scoped evidence; do not relabel as a new owner/browser acceptance |
| Video, public X post, final submission | Owner actions still pending; not submitted by the coding agent |

Release-local tests PASS:443 frontend/39files,649 backend/41files, both typechecks and Vite/direct-tsc builds. Logs: `docs/evidence/phase6-release-frontend.log` and `phase6-release-backend.log`. Audit: frontend10low/0moderate/0high/0critical; backend0 (`phase6-release-*-audit.json`). Existing wallet529kB build warning remains.

Isolated source-tree reproduction also PASS at tree`4ad0a742eb3b046b53d30b3155dacf3de3ccf039`: empty node_modules, cache-only npm ci, frontend443/backend649 tests and both production builds, without copying local environment/tooling. Report and six logs: `docs/evidence/phase6-release-clean-report.json` / `phase6-release-clean-*.log`. Subsequent changes were documentation/evidence only. This does not prove a live server, online newcomer, browser/mobile, Postgres integration or contract/sandbox run.

Unauthenticated GitHub API recheck confirmed public/main. Frontend CI success at prior c36b78d, backend at0ccf970 and contract at51764fd are retained in `phase6-release-public-ci.json`; do not call them same-SHA CI for this release. Phase4/5 remain PARTIAL for real-browser/mobile, ambiguous financial cancellation/in-flight reload and broader model evaluation. The prototype is not audited or Mainnet-ready.

## Five-minute rehearsal without signatures or payments

1. Keep the Vite frontend running. Open `http://localhost:5173/near#/overview` and hard-refresh.
2. Read the purpose statement, then select the evidence-demo action. No wallet is required.
3. On Bằng chứng, select English. Click all four historical cases and inspect at least one exact Explorer link. Explain that these are archived verified transactions.
4. Narrow the browser to roughly 390 px. Use Menu, inspect the case buttons/result and return to the overview. Record any clipped controls before calling mobile accepted.
5. Open Hướng dẫn. Ensure “not sure after signing” leads to history and preserves existing operations. Do not erase localStorage or sign another withdrawal for this rehearsal.
6. Optional: start the already-configured owner backend, check its status and read the existing grant. Do not renew a revoked grant just to record the historical demo. Gemini is not needed for the core video.

If the API is down, the evidence tour remains usable. Live wallet operations require the API and existing operator setup. A green API connection is not transaction settlement. F5 requires a new sign-in for private data; it must not automatically resend payments.

## Official requirements rechecked 2026-11-12

Source: https://nearhackathon.com/HACKATHON.md (Q-002/003/010/012/014 and submission procedure).

- Deadline: **2026-11-14 23:59 UTC = 2026-11-15 06:59 Vietnam**. Target submitting on Nov13 leaves time for errors.
- Public source repository, reproducible instructions and public demo post on X are required. A local-only project needs a **video**, not screenshots alone.
- The human publishes the X post, mentioning NEAR HACKATHON with `@NEARProtocol` and `#NEARHackathon`.
- Submit once through https://nearhackathon.com/#apply with the public repository and demo-post URLs. The NEAR payout account is **Mainnet**, not one of this project's `.testnet` demo accounts. Owner must choose/confirm it; never infer an address.
- Confirm name, contact email, team size, track, exact description and the organizer's contact notice before submission. Do not commit personal submission payloads or tokens. No form/API submission has been performed here.

## Owner steps before sending

- [ ] Complete the short visual rehearsal above on the actual machine.
- [ ] Record and watch the video described in `NEAR_DEMO_RECORDING.md`; redact personal tabs/notifications and never show `.env`, keychain or recovery words.
- [ ] Publish the demo post using the draft in `NEAR_SUBMISSION_DRAFT.md`, then copy its public URL.
- [ ] Check GitHub main is public and contains README, LICENSE and the NEAR entry instructions.
- [ ] Confirm the personal Mainnet payout address, email, personal name and team size in the form. Do not use a demo `.testnet` address for payout.
- [ ] Review all fields and submit once. Keep the confirmation; use the organizer's request-changes flow for later corrections.

Do not add new protocol integrations or perform dependency force-upgrades during this release unless a verified blocking bug requires them. A successful local build is not a submission confirmation or an award prediction.
