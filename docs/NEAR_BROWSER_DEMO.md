# NEAR browser demo — implementation checkpoint

Status: PARTIAL for the full Phase4 acceptance gate. The owner completed the browser financial walkthrough on 2026-11-04; all nine financial transactions below are independently FINAL-verified through public RPC. Browser NEP-413 interoperability and UI operation are owner-observed, not an automated browser test. Unit tests/build remain separate from Testnet evidence. The newcomer/README-only guided-demo acceptance still needs validation.

## Verified browser financial walkthrough — 2026-11-04

Owner: `nhat-redline-web.testnet`; grant: `grant-1b031438090c4fa1902eb9ddcbd1f47c`.

| Action | Independently verified result | Evidence in docs/evidence |
|---|---|---|
| Storage0.05NEAR | FINAL CONFIRMED; historical storage return0.04835 | phase4-web-storage-verification.json |
| Principal0.1NEAR | FINAL CONFIRMED; historical credited0.1/spent0 | phase4-web-principal-verification.json |
| Create/revoke grant | Both FINAL CONFIRMED; exact canonical policy, owner and order | phase4-web-owner-actions-verification.json |
| ALLOW0.01NEAR | FINAL SETTLED/OK; completion event and stored intent match | phase4-web-allow-verification.json |
| Cap/recipient/replay/revoked | Four FINAL REJECTED; exact reasons and stored intents, no recipient execution | phase4-web-rejections-verification.json |

Independent current ledger/grant snapshots show principal0.09NEAR, spent0.01, pending0, nonce1 and revoked grant. Current snapshots are not historical before/after payee balance-delta proof. Original memory-only review timestamps are not independently archived. No repeat funding, signatures or key reset is needed to review this evidence. This was a human-guided browser run, not a one-click unattended demo or production security audit.

## Run locally

1. Terminal 1 (retain the existing local database and executor key):

   ```powershell
   Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
   .\scripts\start-near-local.ps1
   ```

2. Terminal 2:

   ```powershell
   Set-Location 'D:\Project\AI Engineer\redline-near-guardrails'
   npm.cmd run dev -- --host localhost --port 5173 --strictPort
   ```

3. Open <http://localhost:5173/near>. Use localhost, not 127.0.0.1: backend NEP-413 configuration binds recipient `localhost:5173` and callback `http://localhost:5173/near/auth/callback`. The original Solana UI remains at `/`; it is lazily loaded separately.

The current provider is [Intear Wallet](https://wallet.intear.tech), configured explicitly for Testnet. MyNearWallet was removed after the owner's live popup confirmed it no longer accepts new dapp connections. If the owner account exists only in the CLI keychain, stop at the wallet's import/create screen and coordinate an owner-approved credential/account strategy; changing wallet providers does not move accounts or funds. Do not paste recovery phrases, private keys, executor.json or CLI session.json into REDLINE or chat. Browser sign-in is independent of the CLI session. Its bearer stays in memory, expires after30 minutes, and is cleared on reload; saved grant IDs/public intent JSON contain no credentials.

Wallet connection omits `contractId` and method permissions: no on-chain FunctionCall authority is requested. The Intear SDK generates/stores its own revocable local app-auth key for wallet connection/logout; this is separate from owner FullAccess keys and the backend executor key. The coding agent never reads browser credential storage. NEP-413 authenticates the owner; the backend still requires finalized FullAccess-key ownership and the exact signed callback. Grant/revoke actions remain separate explicit wallet signatures. SDK: [official Intear adapter source](https://github.com/near/wallet-selector/blob/main/packages/intear-wallet/src/lib/intear-wallet.ts), pinned core/Intear10.1.4 and transactions2.5.1. Tests run the actual installed adapter against synthetic DOM/messages to confirm Testnet/no contract permission/exact callback forwarding; this is not real browser interoperability proof.

After this provider/dependency change, close the obsolete popup, restart only Vite (Ctrl+C in the5173 window, then rerun the command above), refresh REDLINE and retry login. Keep the8787 backend window open. Do not repeat the settled payment. A Meteor adapter was evaluated and removed: its signMessage wrapper drops callbackUrl, while REDLINE deliberately preserves callback binding rather than falling back to the CLI signature mode.

## Guided sequence

- Connect/sign in. Read an existing grant's FINAL snapshot before preparing any new authority. The CLI8h grant has been signed and its API payment verified. Open `/near?grant=grant-fed48ec7b5db4ba59fe224d9f807d64f` and read FINAL snapshots without logging in or creating another proposal.
- A separate web owner needs its own vault setup. Use “Đọc vault của ví đăng nhập”. An explicit contract registration panic is shown as unregistered, never as a fabricated zero ledger. Review storage0.05NEAR Testnet first, then initial principal0.1NEAR Testnet, each as a separate unsigned proposal and separate wallet signature. Funding is not automatically submitted. Sufficient storage blocks another storage proposal; existing credited principal blocks automatic replenishment. Existing CLI-owner funds/grants do not migrate.
- Before opening a funding signature, the public expected owner/method/amount/baseline height is durably saved. After the wallet returns a public hash, authenticated reconciliation independently checks exact FINAL owner/vault/method/amount/empty args/100Tgas, successful receipts and ledger return, plus execution after the baseline. UNKNOWN/timeouts retain this attempt and block another signature; restore it after reload/login and reconcile, rather than paying again. If cancellation produced no hash or a runtime failure occurs, stop for manual review. There is no contract-level idempotency key for deposit and no automatic retry of owner signatures. Do not use multiple tabs for funding.
- For a new browser grant: choose1–8 hours, cap0.05 nativeNEAR, max3 transfers, only approved payee. Review exact JSON/hash/expiry, then open wallet. The browser rejects modified receiver/executor/cap/recipient/deposit/canonical policy. Preparation does not sign or fund anything. Expiry starts at preparation; login never extends it.
- Read FINAL snapshot after wallet confirmation. Grant storage and principal must already be sufficient; this page does not automatically fund accounts. If storage/funding is needed, stop for owner review.
- Prepare ALLOW0.01, inspect JSON, explicitly send. UNKNOWN/PENDING keeps the exact intent ID. Reload: restore public request, log in, read its grant, reconcile the same intent. Never replace an unresolved request. Journal statuses and Explorer links are available; use “Đối soát FINAL” for recorded hashes.
- Only after a terminal journal state, unlock next case. Replay nonce0 requires a prior settled nonce0 call; otherwise nonce0 can be valid. Cap case requests cap+1yocto; recipient case requests owner (outside sole approved payee). Each denial still incurs gas/storage.
- Review/sign revoke, refresh active=false, then a fresh controlled request should demonstrate REVOKED. Revocation does not cancel already-dispatched transfer receipts.

The owner-observed live browser walkthrough has the independent transaction evidence above. No automated browser E2E, full historical discovery, LLM prompt attack or production security audit is claimed. Current scenarios are explicitly controlled JSON proposals. Preserve the contract's real sandbox concurrency/failure proofs separately.

Browser sign-in and the financial walkthrough for nhat-redline-web.testnet were observed in the owner's screenshots; all nine financial receipts are now independently archived. For a new local startup, use start-near-local.ps1; no Prisma regeneration or database migration is needed. After a full page reload, sign in again because the bearer is memory-only. The recorded grant has been revoked; do not expect it to allow another payment.

## Dependency and deployment limits

`phase4-dependency-audit.json` records16 findings (10low/3moderate/3high/0critical), compared with6 before wallet integration. New low advisories propagate through NEAR SDK dependencies; assess them before hosted release, rather than force-upgrading incompatible SDKs. The build currently warns about the wallet chunk over500kB. No Site was registered/published; no public visibility, GitHub credentials or wallet keys were changed.
