Key reset FINAL and local journal recovery are verified. Do NOT repeat reset, original funding, or the expired original grant/intent. Original packet remains archived as INVALIDATED, not on-chain settlement. Original grant expired November3,2026 at15:20:16.906 UTC+7. Available principal remains0.1 NEAR at recovery verification.

PowerShell1: start the rebuilt backend and keep this window open:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
.\scripts\start-near-local.ps1
```

PowerShell2: fresh off-chain login, then explicitly prepare a NEW unsigned owner-reviewed grant using retained principal:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/near-login-cli.ts
npx.cmd tsx scripts/prepare-near-api-demo.ts --after-key-reset
```

Review cap0.05 native Testnet NEAR, max3, cooldown0, one-hour expiry, executor nhat-redline-agent.testnet, recipient only nhat-redline-payee.testnet. Helper prints create_grant CLI command for owner signature with deposit0; it never signs/submits or prints a recovery topup. Old package/evidence/binding remain intact; new proposal IDs retained on retries. Run the printed create_grant command only after reviewing those values; share its public transaction ID for FINAL verification before submitting a transfer.

If owner session expired, re-login. If principal differs or proposal expired, stop for reconciliation; never silently replace IDs/fund again. Keep both windows open after startup. Do not run execute-near-api-demo --submit until the NEW grant is verified. Never share session.json or executor.json.

Successful recovered80Tgas API execution, callback and ledger/payee proofs remain pending. New recovered API response will be saved separately as phase3-api-recovered-safe-response.json. Phase3 remains PARTIAL.
