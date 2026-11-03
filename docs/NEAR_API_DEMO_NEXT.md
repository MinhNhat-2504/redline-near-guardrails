Previous scoped80Tgas attempt is archived FINAL REJECTED/EXPIRED. NEW owner-reviewed grant grant-c6acee2055d848febbdafce9eba0ed49 is FINAL verified, active/nonce0 at baseline; cap0.05/max3/payee-only, expires18:34:49.317 UTC+7 November3,2026. Available principal0.1/payee10.05, scoped key allowance sufficient. Do not reset, fund or create another grant. Login/session expiry and grant expiry are independent.

PowerShell1: start the rebuilt backend and keep this window open:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
.\scripts\start-near-local.ps1
```

PowerShell2: prepare the NEW stable0.01 NEAR request:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/execute-near-api-demo.ts
```

Review0.01 native NEAR, nonce0, NEW grant ID above, only nhat-redline-payee.testnet. Then explicitly submit through installed scoped key80Tgas/deposit0:

```powershell
npx.cmd tsx scripts/execute-near-api-demo.ts --submit
```

Keep both windows open and finish before deadline. If owner session expired, run npx.cmd tsx scripts/near-login-cli.ts then reuse the SAME prepared request; login does not extend grant. On UNKNOWN/timeout, keep the request and share public hash/state/reason, never make replacement IDs or fund/reset. Helper expiry checks apply even for saved local requests; existing durable IDs retain exact-packet reconciliation. Never share session.json or executor.json.

Successful80Tgas ALLOW/settlement/callback/payee proof remains pending. Renewed response uses phase3-api-renewed-safe-response.json plus a per-intent archive, preserving EXPIRED proof. Phase3 remains PARTIAL.
