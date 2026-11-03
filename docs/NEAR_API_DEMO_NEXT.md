Both previous demo grants expired; latest helper attempt stopped before creating a request/financial POST, clock checked against FINAL chain. Earlier actual80Tgas EXPIRED rejection is archived. Owner now approves maximum8h demo validity, cap0.05/max3/payee-only/key scope unchanged. No key reset/principal topup. Actual scoped ALLOW remains pending; available principal0.1/payee10.05 at last verified financial snapshot.

PowerShell1: start the rebuilt backend and keep this window open:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
.\scripts\start-near-local.ps1
```

PowerShell2: fresh off-chain login and explicitly prepare a NEW eight-hour unsigned grant:

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npx.cmd tsx scripts/near-login-cli.ts
npx.cmd tsx scripts/prepare-near-api-demo.ts --renew-expired-grant --grant-hours 8
```

Review validity8h/deadline UTC+7, cap0.05 native NEAR, max3, only nhat-redline-payee.testnet/executor nhat-redline-agent.testnet. Run only the NEW owner create_grant command the helper prints (deposit0), then share public transaction ID for FINAL verification before transfer. Do not reuse an old $grantFile variable. No financial action or real8h proposal executed by coding agent.

Keep both windows open. Eight-hour deadline is measured from preparation, not each retry/login. Default without option is1h only for NEW proposals; existing proposal retries preserve exact duration/deadline and explicit mismatches stop. Login does not extend grants. Never share session.json or executor.json.

Successful80Tgas ALLOW/settlement/callback/payee proof remains pending. Renewed response uses phase3-api-renewed-safe-response.json plus a per-intent archive, preserving EXPIRED proof. Phase3 remains PARTIAL.
