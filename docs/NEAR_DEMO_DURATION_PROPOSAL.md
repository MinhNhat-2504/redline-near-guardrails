Status: OWNER APPROVED maximum8h in latest chat instruction; implemented as explicit helper option. No actual8h proposal/signature/transaction executed by coding agent.

Repeated manual Testnet handoffs exceeded the current one-hour grant. Latest grant grant-c6acee2055d848febbdafce9eba0ed49 expired18:34:49.317 UTC+7 November3,2026. At the next attempt machine and FINAL-chain clocks were both about18:59; no clock skew explanation. Helper refused before creating a local transfer request or financial API POST; no new chain fee from those blocked attempts.

Approved: allow an explicitly selected integer validity from1 to8 hours for a NEW unsigned demo grant. Default for new proposals remains1h; the next owner-selected demo may use --grant-hours8 (space before value). Keep native Testnet NEAR cap0.05, max3 transfers, cooldown0, executor nhat-redline-agent.testnet, recipient only nhat-redline-payee.testnet. Preserve scoped key vault/execute_transfer restriction and allowance ceiling0.1; no key reset, principal topup, existing-grant mutation or indefinite authority.

Eight hours extends the interval during which the bounded delegation could be exercised. It does not increase total grant spend or add recipients/methods. User first selected1h, then explicitly corrected to maximum8h; latest instruction authorizes this helper bound. Owner will still review and sign the newly computed absolute deadline/grant ID/policy hash locally. Existing expired grants/packets/evidence remain archived. No new grant or private credential created/read by coding agent. The1..8h bound applies to this demo preparation helper; generic owner-defined contract/API policy expiry is unchanged.

Implemented: --grant-hours <1..8>, including option/mode order validation and rejection of unknown/duplicate/out-of-bound/fractional values before session access. New package stores preparation time/selected hours/exact expiry, validates it against canonical policy; retry preserves exact deadline and refuses explicit duration changes, including legacy one-hour proposals.399 units + typecheck/direct build + standalone helper compile/help PASS (synthetic unsigned/canonical tests, not public8h proof). First standalone compile exposed CLI-mode type narrowing and was corrected/rerun; no failed compile counted as PASS.

USER steps (backend remains open):

```powershell
npx.cmd tsx scripts/near-login-cli.ts
npx.cmd tsx scripts/prepare-near-api-demo.ts --renew-expired-grant --grant-hours 8
```

Review displayed validity8h/deadline UTC+7/cap0.05/max3/one payee and sign only the NEW create_grant command helper prints. No recovery topup. Return public transaction ID for independent FINAL verification before transfer. No actual8h grant prepared/submitted by coding agent; Phase3 ALLOW proof remains pending.
