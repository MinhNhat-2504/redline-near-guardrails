# NEAR backend - Phase 3 implementation checkpoint

Status: **PARTIAL phase**. NEAR-native API/auth/adapter and durable receipt reader are implemented and tested. Actual public Testnet API execution with a newly installed scoped executor key and a new owner-signed grant is **NOT RUN**. Frontend wallet onboarding/callback UI remains Phase 4. No mainnet support.

## Runtime and startup

- Node **>=22.22.2** required by pinned official `near-api-js@7.4.0`; verified locally with Node 24.14.1/npm 11.11.0. CI uses Node 24.
- PostgreSQL is required. Keep the connection credential in your local environment/deployment secret store; never send it in chat or commit it.
- `backend/src/server.ts` dispatches `CHAIN=near` to the NEAR server, otherwise to the preserved legacy server. The legacy server blob is unchanged (`101d667a6b9143fc497fa58bc2c230b28486b5f8`). Existing mock/Solana adapters and routes retain their behavior in the legacy server.
- `npm start` no longer executes the inherited `prisma db push --accept-data-loss` at startup. Schema changes are explicit. For an inherited local mock/Solana database, run its documented setup separately. Starting the NEAR API must never silently alter/drop inherited tables.

From `backend/`:

```powershell
npm.cmd ci
npm.cmd run build
# Set DATABASE_URL locally first, then review/apply the ADDITIVE SQL:
npm.cmd run db:near

$env:CHAIN = 'near'
$env:NEAR_APP_ORIGIN = 'http://localhost:5173'
$env:NEAR_NETWORK = 'testnet'
$env:NEAR_CONTRACT_ID = 'nhat-redline-vault.testnet'
$env:NEAR_EXECUTOR_ID = 'nhat-redline-agent.testnet'
npm.cmd start
```

`db:near` applies `prisma/near-migrations/001-near.sql` once: atomic CREATEs for Near* tables and unsigned numeric bounds. It adds no foreign keys or modifications to inherited tables. Do not use `db push --accept-data-loss` for deployment. A missing migration prevents NEAR startup. This is the first additive migration; reapplying it to already-created tables intentionally fails rather than silently changing them.

Required application origin must be an exact HTTPS origin; HTTP is allowed only for localhost/127.0.0.1. Recipient and callback are derived from that trusted configuration, never request input. Server currently binds **127.0.0.1** for local development; a remote public deployment is not claimed. Default RPC is `https://test.rpc.fastnear.com`, verified by `chain_id=testnet` before use. `NEAR_RPC_URL` may select an HTTPS Testnet archival provider if historical data is unavailable. Mainnet is rejected.

The default direct-call scanner begins at 275991840, after this demo's verified initialized-state checkpoint. For another contract, explicitly set `NEAR_START_BLOCK` to the intended first block. It persists scope `testnet:<contract>` and resumes a finalized hash-linked watermark. A failed query, continuity mismatch, malformed receipt or unresolved transaction retains the cursor. Explicit skipped heights need a later header proving `prev_hash` continuity. Never reset/jump the watermark merely because RPC is slow/pruned.

## Owner authentication

1. `POST /near/auth/challenge` with `{ "accountId": "your-account.testnet" }`.
2. Wallet signs NEP-413 using the returned exact message/recipient/callback, and **nonce decoded from base64 to 32 bytes**. Keep and return `state` unchanged. The wallet holds the FullAccess secret; the backend never needs it. Challenge binds account, Testnet, recipient, state and five-minute expiry.
3. `POST /near/auth/verify` with challengeId/state/accountId/publicKey/base64 signature. Backend verifies the signature with the official SDK and the claimed account's current **finalized FullAccess key**; unsupported key schemes and failed RPC checks are refused.
4. Use returned token as `Authorization: Bearer ...`. Session lasts 30 minutes, token stored by hash only. Challenge consumption and session creation are atomic. Every authenticated action rechecks the key is still FullAccess on the finalized chain. `/near/auth/logout` invalidates the token.

No shared API key, unset-key bypass, raw Solana-address verification, Solana session or URL-token fallback exists on the NEAR API. Web-wallet callback UI is still unimplemented; this API does not claim a complete browser sign-in flow.

## Owner operations and executor boundary

`POST /near/owner-actions` requires the owner session and prepares an **unsigned** Wallet Selector-style transaction for deposit/storage_deposit/create_grant/revoke_grant/withdraw. Only that wallet signs it. Create-grant canonical SHA-256 binds Testnet, contract, owner, grant ID, executor, asset and exact limits. Withdrawal preparation checks actual finalized available principal; contract rechecks it on execution. Retain the reviewed draft and wallet transaction hash across retries; do not regenerate and re-sign a new action to resolve an uncertain prior transaction.

All money, nonce and nanosecond fields are canonical decimal **strings**. PostgreSQL uses Decimal(39,0) for u128 amounts and Decimal(20,0) for u64 nonce; cache snapshots cannot regress to older blocks. `createdAt` on journal rows is ingestion time, not a claimed on-chain execution timestamp.

The server starts with `signingEnabled=false` when no executor key is configured. Authenticated intent submission then returns 503 and submits nothing.

The owner-approved model uses a **new FunctionCall key on the separate agent account**, not an owner/vault/agent FullAccess secret. Restrict it to:

- Receiver `nhat-redline-vault.testnet`.
- Exactly one method `execute_transfer`.
- Gas allowance 0.1 NEAR, attached deposit zero. Gas allowance is not a transfer budget; on-chain grants still enforce all limits.

**User-run key preparation, no RPC or signing:**

```powershell
Set-Location 'D:\Project\AI Engineer\redline-near-guardrails\backend'
npm.cmd run near:prepare-executor
```

This creates a new candidate under ignored `.tooling/near-executor/` and prints only public metadata plus a concrete `near account add-key ... grant-function-call-access ...` command. It never reads the OS keychain or installs permissions. Existing candidates are preserved across retries. The coding agent has not run it in the real workspace; tests use disposable temporary directories only. Review and manually sign the printed AddKey command as the agent account. Never share/commit `executor.json`.

After installation is independently verified, the user/operator can load **public metadata** (not print the private file) into server config:

```powershell
$executor = Get-Content -LiteralPath ..\.tooling\near-executor\public.json -Raw | ConvertFrom-Json
$env:NEAR_EXECUTOR_PUBLIC_KEY = $executor.publicKey
$env:NEAR_EXECUTOR_CREDENTIAL_PATH = $executor.credentialPath
```

Startup verifies the public on-chain permission before reading the explicitly configured new credential file, rejects FullAccess/unlimited/extra-method/wrong-receiver keys, and checks derived public-key equality. Permissions are rechecked before each broadcast, including retries. Credential/SDK/DB errors are not reflected in API responses. Installing a new key, providing a database credential, funding principal and signing a new grant remain user actions; architecture approval is already given and need not be requested again.

The old demonstration grant is revoked/expired and available principal is zero. Do not blindly repeat funding/withdrawal; a writable API demo needs a new explicitly reviewed grant and funding step.

## Intent journal and receipts

- `POST /near/grants/:id/intents` accepts grant_id/intent_id/nonce/asset/recipient/amount/policy_hash; requires the current owner's NEAR session. IDs are 1-64 ASCII alphanumeric/underscore/hyphen; asset is NEAR only. Contract makes the policy decision, including intentional negative tests.
- Persist exact intent args, key nonce, signed packet and predetermined hash in a Postgres transaction **before broadcast**. Per-executor advisory locks serialize requests across processes. An unresolved packet blocks new signing; a retry uses the same packet/ID/nonce/hash. Changing args under an existing intent ID returns 409.
- Broadcast is bounded, single-attempt; uncertainty yields `state=UNKNOWN`, `phase=SUBMISSION_UNCERTAIN`, `finalized=false`. It does not assert a chain reservation. A known nonfinal chain transaction remains PENDING until finalized proof; only matching FINAL vault events/callbacks establish SETTLED/REJECTED/FAILED. Runtime failure and policy rejection remain distinct. No RPC timeout triggers an off-chain fund release.
- `POST /near/transactions/track` reconciles a public hash/signer through FINAL receipts. `GET /near/transactions?grantId=...` returns the owner's journal without signed packet or secret fields. Grants/balances have public read routes under `/near/`.
- Events and terminal checkpoint commit atomically with stable tx/receipt/log IDs. Finalized grant projections are refreshed from chain, not counter arithmetic. The reader also scans hash-linked finalized blocks/chunks for **direct transactions whose receiver is the vault**. Calls routed through other contracts are outside this discovery scope; arbitrary third-party contract executors are not claimed as supported.
- PREPARED/SUBMISSION_UNKNOWN packets resume by the same signed payload after restart. If a packet expires or cannot be proven included, the queue remains unresolved for review; there is no automatic replacement nonce/new intent or timeout unlock. Owner's on-chain available balance remains independently withdrawable according to contract rules.

## Verified commands and reproduction

```powershell
# backend/
npm.cmd run typecheck
npm.cmd test
npm.cmd run build

# Requires Docker; random credential, localhost port, tmpfs, guarded cleanup.
.\scripts\test-near-db.ps1

# Explicit network opt-in: also read public Testnet and start compiled CHAIN=near server.
.\scripts\test-near-db.ps1 -LiveProof
```

Latest executed results: **347 unit tests**, **18 real Postgres integration tests**, typecheck/TypeScript compile PASS. Prisma was generated earlier against the unchanged schema; the live-server-safe rechecks compile TypeScript without regenerating its Windows DLL. Integration uses actual SDK signatures and temporary in-memory keys with stubbed chain ownership/transport; no public wallet ownership or new signed public transfer is inferred from those tests. Source-array signature normalization failure is retained in evidence, then resolved by converting Borsh-decoded arrays to Uint8Array before cryptographic verification.

Live proof separately exercised actual public RPC, real isolated Postgres and NEAR API reads: seven existing FINAL transactions, finalized ledger/grant, a live public FullAccess-key query, durable restart/dedupe and two finalized discovery blocks. A separately started compiled `CHAIN=near` server reported signing disabled, rejected an unauthenticated owner action (401) and did not expose legacy routes (404). This is not a full deployment-history backfill or public writable/authenticated-wallet E2E proof. See `docs/evidence/phase3-{live-api-proof,startup-smoke}.json` and `PROGRESS.md`.

CI workflow `near-backend.yml` adds a disposable PostgreSQL service, units, migration, DB tests and build. Hosted CI result is not yet verified. Public Testnet signing/NEP-413 browser login, Phase 4 UI, professional audit and existing npm advisories remain open. No swap/NEP-141/marketplace support is claimed.

## Current scoped-key/local-start checkpoint

User's AddKey is independently verified FINAL: [5KvXEx522c69FErHRmrxDahpMA8XzxFKXuKXAsnUA1BZ](https://explorer.testnet.near.org/transactions/5KvXEx522c69FErHRmrxDahpMA8XzxFKXuKXAsnUA1BZ). Current permission matches exactly vault/execute_transfer/0.1 NEAR allowance. Do not add the same key again. The coding agent has not read its private file.

For this Windows workspace, persistent local database setup has been performed separately from disposable tests. From backend, the USER can start the API with:

```powershell
.\scripts\start-near-local.ps1
```

It reuses the labeled local development DB and volume, exports local process config and starts compiled Node server. Runtime first verifies public on-chain scope before loading the explicitly configured new executor file. Keep that window open. Visit `http://127.0.0.1:8787/health`; expect chain=near, network=testnet, signingEnabled=true. No transfer occurs on startup. `-SetupOnly` was executed/verified without opening the executor credential or starting the API. Actual installed-key startup, owner sign-in and writable E2E remain pending. Local DB metadata/credential stays in ignored `.tooling/near-local/`; do not share or commit it. Stopping the API leaves DB data intact.

## CLI owner sign-in (near-cli-rs 0.30.1)

Installed-key server health is now independently verified with signingEnabled=true. To load CLI-login support, restart the API after the compiled update. Keep that window running and open a second PowerShell in backend:

```powershell
npx.cmd tsx scripts/near-login-cli.ts
```

This USER-run command prints an off-chain sign-in challenge, delegates signing to the owner's local NEAR CLI keychain, converts the CLI's public ed25519:base58 signature to the API's base64 encoding, verifies it and checks /me. It never reads an owner secret file or sends a transaction. Token is saved only in ignored `.tooling/near-local/session.json`, never printed or placed in committed evidence. Only account/public key/challenge ID/expiry/authenticated status can be recorded as a public outcome. Do not share session.json.

CLI 0.30.1 source uses callback_url=None: [tagged signer source](https://github.com/near/near-cli-rs/blob/v0.30.1/src/commands/message/sign_nep413/signer/mod.rs), [tagged signature output](https://github.com/near/near-cli-rs/blob/v0.30.1/src/commands/message/sign_nep413/signature_options/sign_with_keychain.rs). Explicit clientType=cli is therefore selected when issuing the challenge and retained server-side, rather than trying both signature payloads. Browser-wallet default still signs the exact configured callback. Mixed payloads are rejected; one-time nonce/state/recipient/network/account/expiry and finalized FullAccess ownership checks remain mandatory. Real owner helper signing is not claimed until user executes it. `--check-cli` only checks executable version and does not issue/sign a challenge.

## RPC recovery and next owner-reviewed API demo

Actual CLI owner login is now verified; session tokens remain local. Public rpc.testnet.near.org returned429 during backfill, so default/local setup uses the Testnet FASTNEAR endpoint listed in [official NEAR providers](https://docs.near.org/api/rpc/providers). HTTPS/network identity checks remain mandatory. Shared budget spaces requests by2s; a429 triggers bounded Retry-After cooldown, no immediate retries. The background reader scans one block per30s cycle and never skips failed history. Temporary RPC unavailability returns503 without deleting/invalidating a valid session. Full historical catch-up is not claimed. Local helper accepts -RpcUrl to choose a reviewed HTTPS Testnet/archival provider; public FASTNEAR archival availability is not assumed.

After restarting backend, the USER may prepare a small API demo in another terminal:

```powershell
npx.cmd tsx scripts/prepare-near-api-demo.ts
```

It reads the user's local session, requests unsigned owner actions from the real API, and prints reviewable CLI deposit/grant commands. Target principal0.1 NEAR; total grant cap0.05 NEAR, max3, only nhat-redline-payee.testnet, cooldown0, one-hour expiry. Candidate is retained under ignored .tooling/near-api-demo; no owner key or token is printed. Helper never signs, transfers or invokes an executor intent. Review the printed policy and amounts before signing. It refuses to blindly issue a second topup instruction after one was already issued; reconcile prior funding first. Existing grants/IDs are never silently replaced on retries. Expired sessions require the off-chain login helper again, not new funding. Actual new proposal/signatures/public API execution are not yet claimed.
