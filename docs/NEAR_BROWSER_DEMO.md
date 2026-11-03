# NEAR browser demo — implementation checkpoint

Status: PARTIAL. Browser wallet signing and actual browser transfer NOT RUN. Unit tests/build are separate from Testnet evidence. Phase3 scoped-key API ALLOW is now independently verified; this does not establish browser wallet interoperability.

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
- For a new browser grant: choose1–8 hours, cap0.05 nativeNEAR, max3 transfers, only approved payee. Review exact JSON/hash/expiry, then open wallet. The browser rejects modified receiver/executor/cap/recipient/deposit/canonical policy. Preparation does not sign or fund anything. Expiry starts at preparation; login never extends it.
- Read FINAL snapshot after wallet confirmation. Grant storage and principal must already be sufficient; this page does not automatically fund accounts. If storage/funding is needed, stop for owner review.
- Prepare ALLOW0.01, inspect JSON, explicitly send. UNKNOWN/PENDING keeps the exact intent ID. Reload: restore public request, log in, read its grant, reconcile the same intent. Never replace an unresolved request. Journal statuses and Explorer links are available; use “Đối soát FINAL” for recorded hashes.
- Only after a terminal journal state, unlock next case. Replay nonce0 requires a prior settled nonce0 call; otherwise nonce0 can be valid. Cap case requests cap+1yocto; recipient case requests owner (outside sole approved payee). Each denial still incurs gas/storage.
- Review/sign revoke, refresh active=false, then a fresh controlled request should demonstrate REVOKED. Revocation does not cancel already-dispatched transfer receipts.

No live browser E2E, full historical discovery, LLM prompt attack or production security audit is claimed. Current scenarios are explicitly controlled JSON proposals. Preserve the contract's real sandbox concurrency/failure proofs separately.

## Dependency and deployment limits

`phase4-dependency-audit.json` records16 findings (10low/3moderate/3high/0critical), compared with6 before wallet integration. New low advisories propagate through NEAR SDK dependencies; assess them before hosted release, rather than force-upgrading incompatible SDKs. The build currently warns about the wallet chunk over500kB. No Site was registered/published; no public visibility, GitHub credentials or wallet keys were changed.
