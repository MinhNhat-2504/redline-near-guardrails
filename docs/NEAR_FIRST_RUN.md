# NEAR first run — Testnet only

Choose one path. Viewing recorded evidence needs no wallet, new deposit, grant or executor reset. A fresh signed demo requires operator setup and explicit wallet signatures. No Mainnet account or asset is used.

## A. Review existing evidence first

After installing frontend dependencies (`npm ci`), start the frontend from the project root:

```powershell
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173/near`. In the new sidebar choose **Bằng chứng** (`#/proofs`): nine historical browser receipts can be filtered by completed payment, rejection and owner action. Links are available even if the local backend is unavailable. Explorer may open a selector: choose a Testnet explorer such as Nearblocks. Historical evidence is not the status of a new request.

With the backend already configured/running, the Overview action **Khám phá demo đã xác minh** explicitly reads the recorded revoked grant and opens **Hạn mức & quyền**. This is a public read, not a signature. The Proofs page also has **Mở snapshot demo đã thu hồi**. If a saved request/funding/proposal exists, changing grants is blocked until reconciliation; the external receipt cards remain available. No extra funding or signature is needed to inspect historical evidence.

## B. Resume the already-configured local installation

Keep two PowerShell windows open. If either port is already in use, first find the existing project terminal; do not kill unrelated processes or change the callback port.

Backend window:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
.\scripts\start-near-local.ps1
```

Frontend window:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails'
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173/near`, not the backend root. `http://127.0.0.1:8787/health` is API health; its root `/` returning404 is normal. API must report near/testnet/identityEnforced:true. `signingEnabled:false` allows public reads but the executor is unavailable for a new transfer. **Hướng dẫn → Kiểm tra kết nối API** retries this check without reloading/signing and reports the successful check time.

New account/history routes require restarting the backend after pulling this change. Vite updates source automatically; restarting it is appropriate after dependency updates. Existing local database and credential files stay in place. Never repeat a key reset or funding merely because the backend was closed.

## C. First installation on another machine

Prerequisites: Git, supported Node (verified24.14.1; backend minimum22.22.2), npm, PostgreSQL/Docker and a Testnet wallet. Clone the repository without replacing its history; install root/backend dependencies with `npm ci`. Run the initial backend build (`npm run build`) once to generate Prisma before starting the backend. Do not regenerate Prisma's Windows DLL while the backend is using it.

Follow [backend setup](NEAR_BACKEND_SETUP.md) for the additive Near* migration and application origin configuration. The persistent local script is for a reviewed local environment; do not point test migrations at an unrelated existing database. A fresh signed run also needs an executor whose owner has explicitly installed a FunctionCall key scoped to the vault/execute_transfer with finite gas allowance. The backend receives only that scoped credential in ignored local storage; it never receives an owner's FullAccess key. Follow the setup's review/signature boundary; no credential import is automatic.

An isolated Git-source/cache-only installation now passes frontend/backend npm ci, tests, Prisma generation and builds; see [installation and reload checkpoint](NEAR_RELOAD_ACCEPTANCE.md). This is not an independent newcomer following README on another machine or completing wallet signatures. The latter acceptance remains NOT RUN.

## D. Guided signed demo in the workspace

1. **V? & qu?**: allow localhost popups, choose an Intear `.testnet` account and sign the NEP413 sign-in message only. A fresh page load does not retain the bearer token. No owner FullAccess credential goes into REDLINE.
2. **L?m m?i qu? c?a t?i** reads registration/ledger; **??c s? d? t?i kho?n v?** reads native account amount separately. No zero balance is fabricated during failure and raw account amount is not guaranteed spendable gas.
3. Only for a new empty owner: prepare/review/sign storage0.05NEAR, then separately initial principal0.1NEAR. The global review dialog shows method/signer/receiver/attached amount and opens the wallet only after explicit approval. Existing initial principal disables repeat funding; no automatic replenishment exists.
4. **H?n m?c & quy?n**: load an existing Grant ID, or prepare new cap0.05/max3/payee-only permission on1/2/4/8h. The selected deadline is bound and rechecked; login does not extend it. Review and separately sign create_grant, then read snapshot FINAL. Preparing new permission is blocked while another saved intent remains.
5. **Policy Lab**: analyze a candidate against one FINAL block without signing, gas or a model call. ALLOW is a prediction, not a receipt. The explicit handoff persists a fresh request and opens **Ho?t ??ng** for review, without submitting it.
6. **Ho?t ??ng**: open the financial security test disclosure only when deliberately testing. ALLOW0.01NEAR / cap / recipient / replay buttons prepare JSON. Review the amount/recipient first; **G?i / th? l?i c?ng intent ? Testnet** is an actual executor transaction. Gas/storage can be charged on rejection too. No automatic send or retry occurs.
7. For an already-submitted request, read the matching history row and use **??i so?t FINAL**, or the saved request's separate **??i so?t receipt ? kh?ng g?i l?i** button. It observes the existing transaction. UNKNOWN/PENDING keeps the exact intent. Only matching terminal FINAL evidence enables local case completion; completing does not remove the journal.
8. Revoke only through its unsigned owner review and separate wallet signature. A revoked historical demo needs no new funding/grant. New intent after revoke can be used only in a deliberate signed demo; existing REVOKED proof is sufficient for inspection.
9. History includes owner funding as well as executor rows for the loaded owned grant, limited to100 per query. Copy hash/link are explicit. If Clipboard permission fails, the exact requested hash or URL is displayed for manual selection. It is a local/scoped journal, not a full archival account indexer.

Changing workspace pages preserves loaded session/pending request in the same app. Keyboard Back/Forward and direct links are supported. JSON detail panels are collapsed by default. Mainnet, generative LLM, browser withdrawal and external publishing are not enabled by a visual redesign.

## E. Recovery and navigation

- Backend stopped: start only the backend again; wait for “Server listening”. Frontend stopped: start Vite again. Both must remain open for interactive requests.
- “Popup was blocked”: allow popups for localhost and reopen the wallet. Do not assume any unsigned/cancelled request succeeded.
- Funding uncertainty: keep the persisted attempt and reconcile its exact public hash. No-hash cancellation/runtime failure requires manual review; there is no timeout-based re-sign or automatic clearing. Browser funding storage is a single-tab guard, not an atomic cross-tab lock. Avoid parallel funding tabs.
- Request uncertainty/reload: sign in, load the same grant, restore the saved intent and reconcile it. Do not delete localStorage or generate a replacement ID to bypass pending state.
- Navigation: NEAR header opens the original dashboard/Policy Lab in another tab; the original dashboard has a NEAR Testnet link back. This switches project views, not a wallet network. NEAR remains Testnet-only. Legacy Policy Lab/copilot are preserved but not connected to NEAR policy signing; never treat their simulations as NEAR transactions.

No new browser acceptance PASS is inferred from unit/render tests. Remaining integration and automated-wallet test gaps: [onboarding checkpoint](NEAR_ONBOARDING_CHECKPOINT.md).


### Reload/cancel follow-up (2026-11-05)

Saved public intent/funding now restores before API health, even if backend is stopped. One corrupt record does not hide the other; corrupt/unreadable recovery blocks financial writes. A saved intent selects its original grant on normal reload, so there is no need to click a disabled historical-grant selector. Read the same grant, then use read-only Policy Lab; do not clear storage to unlock it. A successful auth callback is removed from the URL only after verification; retry API connection to retry an interrupted callback. Cancel an unsigned review before opening the wallet. Once the wallet/API operation starts, the local cancel button is disabled; closing a popup does not establish financial cancellation. No-hash funding remains stopped for review. [Verified scope and safe manual steps](NEAR_RELOAD_ACCEPTANCE.md).
