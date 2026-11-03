Run in a second PowerShell while the backend stays open. The owner deposit and grant are now independently verified; do not repeat either transaction. Grant expires November 3, 2026 at 15:20:16.906 UTC+7.

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/near-login-cli.ts
npx.cmd tsx scripts/execute-near-api-demo.ts
```

Login is off-chain. Default execution prepares a public request only. Review amount0.01 native Testnet NEAR, recipient nhat-redline-payee.testnet, nonce0, the existing grant ID and its policy hash. Then explicitly submit through the installed scoped executor key:

```powershell
npx.cmd tsx scripts/execute-near-api-demo.ts --submit
```

Keep the same request/package on retries. On timeout or UNKNOWN, do not generate a new intent or fund again. The same --submit retries the persisted request; backend retains the same signed packet/hash. An expired/revoked grant requires review, not automatic replacement. Share only the printed public transactionHash/state/reason; never session.json or executor.json. A returned API state still needs independent FINAL receipt/public-key/callback and ledger/payee verification. Phase3 remains PARTIAL until that evidence exists.
