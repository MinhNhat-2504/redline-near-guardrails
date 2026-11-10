# Mobile usability and copilot resilience — 2026-11-10

## Implemented

- At widths up to760px, sidebar navigation uses an explicit Menu button instead of requiring discovery of a horizontal tab strip. The button exposes expanded/controls state, pages have an active label, selection closes the menu, Escape closes and restores focus, and selecting the current page restores focus to the menu button. Desktop navigation remains visible.
- History uses labelled single-column cards at narrow widths, preserving explicit table/row/cell roles and column headers for assistive technology. Full hash, exact amount, recipient, status and receipt controls remain available; no inference from visual layout changes financial state.
- Mobile buttons have44px minimum touch height, inputs/selects16px text, wrapping long IDs, and smaller review-dialog padding with safe-area allowance. Reduced-motion preference disables decorative transitions. These are source changes, not measured device acceptance.
- AI has an explicit **Kiểm tra AI · không gọi model** control: GET configuration/status only, no generation, consent, wallet signature or provider request. The UI distinguishes disabled configuration, cooldown and configured model; it explicitly says configuration is not proof of successful inference.
- Local copilot429 gets a dedicated bounded retry message rather than generic financial/auth advice. Login is retained; other API routes keep their existing behavior.
- Model service circuit now covers provider quota429, timeout, network/DNS/reset/unavailable and HTTP500/502/503/504. Consecutive transient failures pause60,120,240,300seconds, capped at300; a valid schema-checked answer resets the counter. Cooldown expiry only unlocks an explicit future request, never invokes a model by itself.
- Bounded Retry-After seconds/HTTP-date hints are read from error headers without reading/logging provider bodies. Values are constrained to1..300seconds; service applies at least its adaptive cooldown. This local maximum is not a promise the remote quota has reset. Header format reference: [RFC9110 section10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after).
- A synchronous UI ref prevents overlapping status/generation clicks before React finishes rendering. Existing owner binding, consent,3/minute/20/hour process budgets, one-inflight limit, explicit configured model, output/body/timeout bounds and old-answer labels remain. No key, model, billing setting, automatic retry or fallback changed.

## Actual verification

Final433 frontend tests/39files and649 backend tests/41files, both typechecks/builds PASS. Five additional frontend cases verify mobile control semantics, history card/table labels, AI status wording/no inference on render and copilot429 behavior.17 additional backend cases cover transient failures, adaptive cap/reset, bounded Retry-After and quota protection. Provider responses use synthetic transports only; no paid generation, runtime credentials, live API/indexer or financial transaction.

Initial backend run had648 passes/1 failure: old process-quota fixture used generic transient errors every61seconds, now intercepted by adaptive cooldown. It now uses a non-transient key rejection to test the unchanged20/hour attempt budget independently; separate tests cover transient protection. The attempted raw-log backup used a wrong relative path, so initial raw file was overwritten; failure summary is from the actual tool transcript, not a reconstructed raw log. Final logs: phase5-mobile-copilot-frontend.log and phase5-mobile-copilot-backend.log. Frontend intermediate log retained separately.

No new dependencies/schema/contract changes. Postgres/Rust/sandbox/audits not rerun locally; previous passing hosted/source evidence remains historical. Existing approximately529kB wallet chunk warning remains. No supported browser-control/user-facing preview tool was available; no real device screenshots or automated wallet E2E executed. Phase4/5 remain PARTIAL, including actual mobile interaction and Gemini live reliability. Provider outages cannot be fixed or success guaranteed by application cooldown handling. Process-local circuit/budget resets at restart and is not shared across replicas.

## Owner acceptance, no payments or model calls needed

1. Keep Docker/Vite running. Restart only the backend with Ctrl+C and `./scripts/start-near-local.ps1` from backend/ to load compiled service changes. Database and keys remain operator-local; do not reset/fund again.
2. Refresh `/near`, reduce window width to roughly390px (or use a real phone with correctly configured origin; a phone's localhost is not your PC). Use Menu to open Wallet/Activity/Policy Lab. Verify each selected page and Escape behavior; history should stack as cards without a full-page horizontal scrollbar.
3. Existing grants/receipts are sufficient. Sign-in, if needed, is a message only. Do not create grants or repeat the settled withdrawal just for UI acceptance.
4. In Policy Lab with an existing snapshot, **Kiểm tra AI · không gọi model** may be checked without a paid inference. Do not use the generation button for this acceptance. An enabled status is configuration only, not provider health.

Live model retesting, if later requested, remains one owner-consented attempt with existing model/key and explicit cost disclosure; no repeated trial loop. Public hosting/origin changes and financial-wallet recovery are separate tasks.
