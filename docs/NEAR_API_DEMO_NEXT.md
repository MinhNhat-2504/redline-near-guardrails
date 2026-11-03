Key reset FINAL, local journal recovery and NEW owner grant are verified. Do NOT repeat reset, funding or grant creation. New grant grant-5c1326cc5e674f78a82be9fbd26744b2 is active/nonce0 at preflight; cap0.05/max3/payee-only, expires November3,2026 at16:57:51.496 UTC+7. Available principal0.1 NEAR; payee baseline10.05. Original packet remains archived as INVALIDATED, not on-chain settlement.

PowerShell1: start the rebuilt backend and keep this window open:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
.\scripts\start-near-local.ps1
```

PowerShell2: prepare the new stable0.01 NEAR transfer request (no submission yet):

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/execute-near-api-demo.ts
```

Review amount0.01 native Testnet NEAR, nonce0, NEW grant ID above, recipient nhat-redline-payee.testnet. Explicitly submit through API (executor uses80Tgas/deposit0):

```powershell
npx.cmd tsx scripts/execute-near-api-demo.ts --submit
```

If owner session expired, run npx.cmd tsx scripts/near-login-cli.ts then reuse the same request. Keep both windows open. On timeout/UNKNOWN, retain package/ID and share public transactionHash/state/submissionError; do not generate replacement intent, reset key or fund again. Never share session.json or executor.json.

Successful recovered80Tgas API execution, callback and ledger/payee proofs remain pending. New recovered API response will be saved separately as phase3-api-recovered-safe-response.json. Phase3 remains PARTIAL.
