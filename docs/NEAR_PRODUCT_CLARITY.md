# NEAR product clarity and guided demo

2026-11-10. Owner requested UI/UX and writing improvements after feedback that visitors could not understand what the product was for. This iteration prioritizes comprehension over additional financial features.

## Changes

- Overview explains bounded AI spending in plain Vietnamese, then gives a clearly labelled illustrative service-payment use case. It explicitly says the current demo uses controlled requests, not an assistant autonomously buying services.
- Primary action opens historical evidence without requiring wallet sign-in, API readiness, or a new grant. Live Testnet setup remains a separate choice. Existing pending-operation guards still protect financial actions.
- Evidence opens with four selectable historical cases: valid 0.01 NEAR payment, excess budget, wrong recipient and post-revocation rejection. Each maps directly to the existing verified transaction hash. No simulated transaction success, new provider call or payment is produced by selecting a case.
- Overview account metrics and operational navigation move into an expandable section, open for authenticated users or saved operations. Amounts remain unknown until read; historical funds are labelled as the currently viewed fund, not automatically the visitor's money.
- Status badges show human-readable Vietnamese alongside raw protocol codes. Policy Lab becomes “Kiểm tra đề xuất”; its prediction appears before an expandable technical gate table. Raw codes and block evidence remain accessible.
- Vault funding/withdrawal labels distinguish spendable funds from storage fees. A purpose-based help screen and expandable glossary explain vault, grant, agent, nonce, FINAL and receipt.
- Responsive start cards, demo controls, result panels and help content use single-column layouts on narrow screens. Existing mobile menu and financial review remain intact. Legacy Solana source, dependencies, backend, schema and contract are unchanged.

## Verified evidence

`docs/evidence/phase5-product-clarity-frontend.log`: 436 tests / 39 files PASS, TypeScript check PASS, Vite production build PASS. Existing deferred wallet chunk ~529 kB warning remains.

Three new synthetic/SSR cases check API-independent evidence entry, binding to historical receipts without network execution, and newcomer recovery instructions. The existing read-only analysis text assertion was updated for the new copy: the initial run had 434 passing / 1 failed text assertion, retained in `phase5-product-clarity-frontend-initial.log` (UTF-8 and trailing-whitespace normalized). Its failure did not imply a financial validator failure.

These are source/render checks, not browser click, viewport screenshot, usability or screen-reader acceptance. No controllable browser preview was available. No real Gemini request, owner login/signature, financial transaction or new RPC proof was run for this iteration. Previous backend649/DB/contract results remain prior evidence and were not rerun for frontend-only changes. Phase4/5 remain PARTIAL.

## Owner visual check (no signature or funding)

1. Refresh `/near#/overview`; check that the opening screen explains what REDLINE controls before asking for a wallet.
2. Select “Xem demo: được phép hay bị chặn?” while logged out. Choose all four situations; confirm each displays a historical result and matching Explorer link without a wallet popup.
3. Narrow to about 390 px and use Menu. Read the demo, then open Hướng dẫn and the glossary. Check for cropped text, horizontal overflow and ambiguous buttons.
4. Existing saved operations must remain retained. Do not erase storage or send a replacement payment to test the presentation.

Owner waived independent newcomer evaluation earlier; no fabricated newcomer test or award probability is recorded. Remaining priorities are actual desktop/mobile feedback on this iteration and a short evidence-led submission video.
