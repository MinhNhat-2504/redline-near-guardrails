# Functional onboarding checkpoint — 2026-11-04

Status: implementation/tests PASS for the bounded changes below; overall Phase4/5 remain PARTIAL. Base commit02c7afd. UI redesign is deferred. No new owner signature, grant, principal deposit, executor reset or public financial transaction was performed.

## Implemented

- State-based next-step guidance, setup/restart help, read-only historical-evidence path and jump links. Revoked/expired grants recommend reviewing history rather than re-funding. Outstanding funding/intent state takes priority over new authority preparation.
- Automatic restore of validated public funding/intent records on startup, with no automatic signing/submission. Session401 clears authenticated UI controls and unsigned proposals but retains the durable request.503 retains bearer; uncertainty remains an error.
- Native account FINAL snapshot endpoint `/near/accounts/:account`, using bounded exact decimal strings/block metadata. UI shows raw account amount/locked/storage caveat separately from vault principal/storage. Failures clear the current display and never fabricate zero. Direct public RPC capture confirms the new parser for `nhat-redline-web.testnet`, block276162643; this is not an end-to-end live HTTP/browser call.
- Authenticated `/near/owner-transactions` includes owner-signed storage/deposit even without a grantId. Filtering uses session account/scope, ignores supplied ownerId and never selects signedBase64/argsJson. Existing grant journal merges/dedupes by hash. Real isolated Postgres test proves grantless funding inclusion, foreign-signer exclusion and hidden packet fields.
- Receipt controls copy full hash or Testnet link with visible/selectable fallback; history no longer requires users to locate a hidden URL in the wallet. All nine browser proof links are visible.
- NEAR→legacy and legacy→NEAR navigation opens separate tabs; no wallet-network permission change. Mainnet remains unsupported. Legacy dashboard/copilot/Policy Lab remain available and explicitly labelled as separate from NEAR signing.
- ALLOW refresh now also refreshes the logged-in owner's vault, reducing stale principal after settlement. Account native balance remains an explicit manual read, with its own block metadata. No background RPC polling added.

## Actual checks

| Check | Result | docs/evidence |
|---|---|---|
| Root npm run check | PASS228 tests/31 files + typecheck/Vite build | phase4-onboarding-frontend-final.log |
| Backend typecheck/npm test/direct tsc | PASS517 tests/38 files + build | phase4-onboarding-backend-final.log |
| Isolated real Postgres | PASS26 tests; temporary container cleaned up | phase4-onboarding-postgres.log |
| Public native-account helper strict compile + FINAL capture | PASS exact u128 strings and block | phase4-onboarding-account-helper.log; phase4-onboarding-public-account.json |

New frontend tests are pure state cases, API mocked-fetch session transitions and actual ReceiptLink server rendering. They are not live browser clicks, clipboard permission or wallet E2E. New backend tests use injected HTTP requests and a real disposable Postgres/SDK-signature flow with mocked chain ownership. Prisma's informational update banner and Vite chunk warning appear as PowerShell NativeCommandError records on stderr; the actual commands completed exit0 and tests/build PASS. No package upgrade was performed for that banner.

## Still unverified or incomplete

- No browser automation/visual preview tool was available; live testing of new controls, clipboard/popup/reload/cancel flows and fresh-clone newcomer acceptance remain pending. The prior owner-operated nine-transaction walkthrough remains valid evidence for the earlier financial flow, not proof of these new controls.
- Existing dashboard/risk copilot/Policy Lab are preserved and reachable; their policies are not yet adapted to NEAR. A NEAR-native policy preview/copilot integration remains separate work and must retain contract policy authority.
- This is a guided set of explicit actions, not unattended one-click funding/signing. Accounts/keys/operator setup still require owner coordination.
- Native account balance is implemented; spendable amount after protocol storage/gas requirements is not computed. Journal is local/scoped/limited, not a full history indexer.
- Dependency state unchanged: previous backend audit0, frontend10low. Hosted CI not executed, remote push authentication unresolved. Current changes are code/tests/docs only; contract/Rust/sandbox were not rerun without contract changes.

For review in the existing environment: restart backend with `start-near-local.ps1`, keep Vite5173 running, sign in again only if needed, read native balance and owner history, then test copy hash/link. Do not repeat settled storage/principal or sign a new grant to inspect these controls. [First run](NEAR_FIRST_RUN.md) distinguishes proof review, resuming local servers and a fresh signed demo.

Account query source checked2026-11-04: [official NEAR view_account RPC](https://docs.near.org/api/rpc/contracts). Snapshot `amount`/`locked` are account fields, never labelled vault principal or guaranteed spendable gas.

- Onboarding pre-commit: staged whitespace PASS; scoped Git history/index credential-pattern scan PASS, 1067 blobs/0 findings; exact inherited TESTONLY fixture exception retained. Report phase4-onboarding-secret-scan.json. Pattern scope only; user-modified login report excluded.

## Owner-observed browser acceptance follow-up — 2026-11-04

Owner supplied screenshots after restarting the local services: native account balance2.3490611243045746NEAR Testnet at FINAL block276164651; own vault principal0.09/storage0.04498; grant owner matches nhat-redline-web.testnet, revoked, nonce1/spent0.01/pending0. Earlier screenshot shows four owner-action journal rows including funding and copy controls. Owner then used copy hash and pasted FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP, exactly matching the independently verified post-revoke rejection. Native-balance display, owner history, vault/grant refresh and copy-hash are now USER-observed working in this browser. No new transaction was needed.

This supersedes pending manual verification for those specific controls only. Copy-link, clipboard-denied fallback, startup/reload/cancel/recovery branches, automated browser E2E, fresh-clone newcomer acceptance and NEAR PolicyLab/copilot integration remain unverified/incomplete. The timer0h0m0s is consistent with the recorded deadline having elapsed; grant remains revoked. No need to renew it, create another grant or fund again. Source/tests unchanged, so no test/build rerun for this evidence-only note. Phase4/5 remain PARTIAL; previous frontend228/backend517/Postgres26 PASS retained.
