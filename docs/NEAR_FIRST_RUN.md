# NEAR first run — Testnet only

Choose one path. Viewing recorded evidence needs no wallet, new deposit, grant or executor reset. A fresh signed demo requires operator setup and explicit wallet signatures. No Mainnet account or asset is used.

## A. Review existing evidence first

After installing frontend dependencies (`npm ci`), start the frontend from the project root:

```powershell
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173/near`. The “Bằng chứng Testnet đã đối chiếu” section links all nine verified browser financial transactions. It is available even if the local backend is unavailable. Explorer may open a selector: choose a Testnet explorer such as Nearblocks. Historical evidence is not the status of a new request.

With the backend already configured/running, “Chọn grant demo đã thu hồi” selects the recorded web grant. Press “Đọc snapshot FINAL” to read current chain state. The recorded grant is revoked; no extra funding or signature is necessary to inspect it. This read-only route is the recommended first step for reviewers.

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

Open `http://localhost:5173/near`, not the backend root. `http://127.0.0.1:8787/health` is API health; its root `/` returning404 is normal. API must report near/testnet/identityEnforced:true. `signingEnabled:false` allows public reads but the executor is unavailable for a new transfer. “Kiểm tra kết nối API” retries this check without reloading or signing.

New account/history routes require restarting the backend after pulling this change. Vite updates source automatically; restarting it is appropriate after dependency updates. Existing local database and credential files stay in place. Never repeat a key reset or funding merely because the backend was closed.

## C. First installation on another machine

Prerequisites: Git, supported Node (verified24.14.1; backend minimum22.22.2), npm, PostgreSQL/Docker and a Testnet wallet. Clone the repository without replacing its history; install root/backend dependencies with `npm ci`. Run the initial backend build (`npm run build`) once to generate Prisma before starting the backend. Do not regenerate Prisma's Windows DLL while the backend is using it.

Follow [backend setup](NEAR_BACKEND_SETUP.md) for the additive Near* migration and application origin configuration. The persistent local script is for a reviewed local environment; do not point test migrations at an unrelated existing database. A fresh signed run also needs an executor whose owner has explicitly installed a FunctionCall key scoped to the vault/execute_transfer with finite gas allowance. The backend receives only that scoped credential in ignored local storage; it never receives an owner's FullAccess key. Follow the setup's review/signature boundary; no credential import is automatic.

No fresh-clone/README-only newcomer run is claimed by this document. The existing installation was exercised by the owner; automated tests and independent public receipt proofs are documented separately.

## D. Guided signed demo in the page

1. Allow localhost popups. Open [Intear](https://wallet.intear.tech/) and choose an existing `.testnet` account. `.near` is Mainnet and cannot connect to this app. Creating/importing a wallet is an owner action; never paste a recovery phrase, executor file or private key into REDLINE/chat.
2. Press “Đăng nhập ví Testnet · NEP-413” and approve only the sign-in message. Sign-in does not authorize a transfer. If the session expires, login controls reappear; saved financial requests remain. Full reload also requires sign-in again.
3. “Đọc số dư tài khoản ví” reads native `view_account` at FINAL. It is distinct from principal/storage in the vault; raw account amount is not a guarantee of spendable gas after account storage requirements. Each successful read shows its block. RPC failure never becomes a zero balance.
4. “Đọc vault của ví đăng nhập” determines registration and balances. For a new empty owner, prepare/review/sign storage0.05NEAR Testnet, then separately principal0.1NEAR Testnet. Each requires a wallet signature. A sufficient/existing balance disables repeat initial funding; no automatic replenishment exists.
5. Choose1–8h and prepare a grant only if a new demo is needed. Review cap0.05NEAR/max3/only approved payee/zero attached deposit, sign `create_grant`, then read FINAL. Expiry begins at proposal preparation; logging in does not extend it. Another owner's grant is read-only.
6. Prepare ALLOW0.01NEAR, review JSON, then explicitly “Gửi / đối soát cùng intent”. This backend executor call is a real Testnet transaction. Wait for FINAL SETTLED/OK. UNKNOWN/PENDING means keep the same request; the page restores public saved requests on startup but never submits them automatically.
7. After terminal FINAL, explicitly complete the old case. Prepare/send over-cap, wrong recipient and consumed nonce0 separately. Policy rejections still cost executor gas/storage. Inspect the actual reason/receipt, not an expected label.
8. Review/sign revocation, read FINAL active:false, then send one fresh controlled request if testing post-revoke denial. Existing demo already has REVOKED proof; no rerun is needed to view it.
9. History now includes owner-signed funding without requiring a grant ID. “Đọc lịch sử giao dịch chủ ví” reads that authenticated local journal; grant refresh adds its executor intent rows. The history is capped at100 per query, scoped to this vault and not a full archival account history. Each receipt has “Sao chép hash”, “Sao chép link” and the selectable full hash. If Clipboard permission fails, select the displayed hash and press Ctrl+C.

## E. Recovery and navigation

- Backend stopped: start only the backend again; wait for “Server listening”. Frontend stopped: start Vite again. Both must remain open for interactive requests.
- “Popup was blocked”: allow popups for localhost and reopen the wallet. Do not assume any unsigned/cancelled request succeeded.
- Funding uncertainty: keep the persisted attempt and reconcile its exact public hash. No-hash cancellation/runtime failure requires manual review; there is no timeout-based re-sign or automatic clearing. Browser funding storage is a single-tab guard, not an atomic cross-tab lock. Avoid parallel funding tabs.
- Request uncertainty/reload: sign in, load the same grant, restore the saved intent and reconcile it. Do not delete localStorage or generate a replacement ID to bypass pending state.
- Navigation: NEAR header opens the original dashboard/Policy Lab in another tab; the original dashboard has a NEAR Testnet link back. This switches project views, not a wallet network. NEAR remains Testnet-only. Legacy Policy Lab/copilot are preserved but not connected to NEAR policy signing; never treat their simulations as NEAR transactions.

No new browser acceptance PASS is inferred from unit/render tests. Remaining integration and automated-wallet test gaps: [onboarding checkpoint](NEAR_ONBOARDING_CHECKPOINT.md).
