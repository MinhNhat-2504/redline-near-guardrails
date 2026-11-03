# NEAR browser demo — implementation checkpoint

Status: PARTIAL. Browser wallet signing and actual browser transfer NOT RUN. Unit tests/build are separate from Testnet evidence. Phase 3 scoped-key ALLOW remains pending the owner's signature and finalized public proof.

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

Existing accounts in MyNearWallet Testnet are supported by the integrated SDK. New account creation is outside this page; MyNearWallet no longer creates accounts. Do not paste recovery phrases, private keys, executor.json or CLI session.json into REDLINE or chat. Browser sign-in is independent of the CLI session. Its bearer stays in memory, expires after 30 minutes, and is cleared on reload; saved grant IDs/public intent JSON contain no credentials.

Wallet connection omits `contractId`, so it creates no browser FunctionCall key. NEP-413 authenticates the owner; the backend requires finalized FullAccess-key ownership. Grant/revoke actions are separate explicit wallet signatures. SDK: [official Wallet Selector API](https://github.com/near/wallet-selector/blob/main/packages/core/docs/api/wallet.md), pinned core/MyNearWallet10.1.4 and transactions2.5.1. Browser interoperability still requires a real owner test.

## Guided sequence

- Connect/sign in. Read an existing grant's FINAL snapshot before preparing any new authority. The outstanding CLI8h proposal can be completed without creating a second browser proposal.
- For a new browser grant: choose1–8 hours, cap0.05 nativeNEAR, max3 transfers, only approved payee. Review exact JSON/hash/expiry, then open wallet. The browser rejects modified receiver/executor/cap/recipient/deposit/canonical policy. Preparation does not sign or fund anything. Expiry starts at preparation; login never extends it.
- Read FINAL snapshot after wallet confirmation. Grant storage and principal must already be sufficient; this page does not automatically fund accounts. If storage/funding is needed, stop for owner review.
- Prepare ALLOW0.01, inspect JSON, explicitly send. UNKNOWN/PENDING keeps the exact intent ID. Reload: restore public request, log in, read its grant, reconcile the same intent. Never replace an unresolved request. Journal statuses and Explorer links are available; use “Đối soát FINAL” for recorded hashes.
- Only after a terminal journal state, unlock next case. Replay nonce0 requires a prior settled nonce0 call; otherwise nonce0 can be valid. Cap case requests cap+1yocto; recipient case requests owner (outside sole approved payee). Each denial still incurs gas/storage.
- Review/sign revoke, refresh active=false, then a fresh controlled request should demonstrate REVOKED. Revocation does not cancel already-dispatched transfer receipts.

No live browser E2E, full historical discovery, LLM prompt attack or production security audit is claimed. Current scenarios are explicitly controlled JSON proposals. Preserve the contract's real sandbox concurrency/failure proofs separately.

## Dependency and deployment limits

`phase4-dependency-audit.json` records16 findings (10low/3moderate/3high/0critical), compared with6 before wallet integration. New low advisories propagate through NEAR SDK dependencies; assess them before hosted release, rather than force-upgrading incompatible SDKs. The build currently warns about the wallet chunk over500kB. No Site was registered/published; no public visibility, GitHub credentials or wallet keys were changed.
