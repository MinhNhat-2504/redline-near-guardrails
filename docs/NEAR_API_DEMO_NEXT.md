The scoped80Tgas API attempt is FINAL REJECTED/EXPIRED: grant expired16:57:51.496, execution17:09:29 UTC+7 November3,2026.0.01 NEAR was not transferred; available principal remains0.1/payee10.05. Gas and intent storage still cost funds. No key reset or topup needed. Login/session expiry and grant expiry are independent.

PowerShell1: start the rebuilt backend and keep this window open:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
.\scripts\start-near-local.ps1
```

PowerShell2: fresh off-chain login, then explicitly prepare a NEW unsigned owner-reviewed grant:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/near-login-cli.ts
npx.cmd tsx scripts/prepare-near-api-demo.ts --renew-expired-grant
```

Review cap0.05 native NEAR, max3, only nhat-redline-payee.testnet, executor nhat-redline-agent.testnet, cooldown0 and one-hour expiry (also printed UTC+7). Run the NEW create_grant command the helper prints after review; it uses deposit0 and owner keychain signature. Do not reuse an old $grantFile variable. Share public transaction ID for FINAL verification before submitting another transfer. Renewed unsigned proposal/packages/IDs are retained on retries; original expired grant and intent evidence stay intact.

Keep both windows open. Complete the next demo before the NEW grant deadline; login does not extend it. New helper checks expiry even for saved local requests before a new financial POST; existing durable IDs can still reconcile exact packets after expiry. Unresolved/revoked grants block renewal. Never share session.json or executor.json.

Successful80Tgas ALLOW/settlement/callback/payee proof remains pending. Renewed response uses phase3-api-renewed-safe-response.json plus a per-intent archive, preserving EXPIRED proof. Phase3 remains PARTIAL.
