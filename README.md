# REDLINE for NEAR

**Give an agent a budget, not your wallet.** A NEAR Testnet safety vault enforcing owner-approved recipients, spending limits, transaction counts, cooldowns, expiry and replay protection on-chain.

NEAR Hackathon 2026 | **Track 06: AI Security & Defense**. Testnet prototype, not audited or Mainnet-ready. Phases 0-3 verified; phases 4/5 remain partial.

[Run locally](#run-locally) | [Transaction evidence](#verified-testnet-transactions) | [Threat model](docs/NEAR_THREAT_MODEL.md) | [Progress](docs/PROGRESS.md) | [Original Solana README](README_SOLANA.md)

## What works

| Feature | Implementation and verified scope |
| --- | --- |
| Owner-controlled vault | Separate storage/principal; wallet-signed deposit, grant, revoke and withdrawal. Real browser withdrawal verified through FINAL receipt, callback and stored view. |
| Bounded executor | FunctionCall key restricted to vault/execute_transfer, zero attached deposit and finite gas allowance. Owner FullAccess credentials never belong in the backend. |
| On-chain policy | Native NEAR, recipient allowlist, spend/transaction caps, nonce, expiry, cooldown and policy hash. Real ALLOW and cap/recipient/replay/revoked rejections archived. |
| Async accounting | Reserve before dispatch; private callbacks settle/release once. UNKNOWN/PENDING never unlock funds by timeout or authorize replacement payments. |
| Wallet sign-in | Intear Testnet NEP-413, signature and FINAL FullAccess-key ownership verification. Login is not a transfer approval. Browser bearer stays in tab memory; F5 requires re-login. |
| Workspace and receipts | Wallet/funds, permissions, Policy Lab, activity, evidence and recovery. Owner operation labels use stored FINAL events; missing details remain unknown. |
| Deterministic Policy Lab | Candidate, grant, ledger and time at one FINAL block. Prediction only; contract execution and receipt determine actual outcome. |
| Optional Gemini copilot | Disabled by default, consented explanations only. One real explanation owner-observed; later risks calls returned HTTP503. No automatic retry/fallback. NEAR enforcement does not depend on Gemini. |

The payment demo submits **controlled JSON**, not an autonomous LLM payment agent. The NEAR version does not implement the inherited Solana marketplace, USDC, swaps, cross-chain settlement or Mainnet.

## Authority and settlement

```text
Owner wallet -- separate review/signature --> deposit / create_grant / revoke / withdraw
                                                NEAR Safety Vault
Authenticated intent -- scoped executor --> policy checks + pending reservation
                                                    |
                                             transfer promise
                                                    |
                                           private callback
                                                    |
                                    FINAL receipt + matching stored view
```

A policy rejection may be a successful NEAR call returning REJECTED, not a failed blockchain transaction. It moves no principal to the proposed recipient, but gas/storage may still be charged. A hash alone is not settlement. Revoke blocks new intents; it cannot recall a transfer already dispatched.

## Run locally

Requirements: Git, **Node >=22.22.2** (tested24.14.1), npm; Docker Desktop/PostgreSQL for the API. Use Testnet accounts only. Never commit keys, seed phrases, tokens or local environment files.

### A. View evidence without wallet, backend or Gemini

```powershell
git clone --branch feat/near-mvp https://github.com/MinhNhat-2504/redline-near-guardrails.git
Set-Location redline-near-guardrails
npm.cmd ci
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Open **http://localhost:5173/near#/proofs**. Recorded links work without login or the API. API health errors do not invalidate historical receipts. Public repository verified2026-11-10; anonymous main clone and README/LICENSE access PASS. Development branch: `feat/near-mvp`; public default branch: `main`.

`/near` is NEAR; `/` preserves the original Solana workspace. Its hosted links/badges are not NEAR evidence.

### B. Fresh read-only API

From a second PowerShell in the checkout:

```powershell
Set-Location backend
npm.cmd ci
npm.cmd run build
# Docker Desktop must be running; prepares the labelled persistent local DB only.
.\scripts\start-near-local.ps1 -SetupOnly
```

SetupOnly prepares the database, not the API. To reuse that local database without copying its generated password into a file or terminal output, run from backend/:

```powershell
$localDb = Get-Content -LiteralPath '..\.tooling\near-local\database.json' -Raw | ConvertFrom-Json
if ($localDb.name -notmatch '^redline-near-local-[a-f0-9]{12}$') { throw 'Unexpected local DB name' }
$dbBinding = (docker.exe port $localDb.name '5432/tcp').Trim()
if ($LASTEXITCODE -ne 0 -or $dbBinding -notmatch '^127\.0\.0\.1:([0-9]+)$') { throw 'Local DB must bind to loopback' }
$env:DATABASE_URL = 'postgresql://redline_local:' + [Uri]::EscapeDataString($localDb.password) + '@127.0.0.1:' + $Matches[1] + '/redline_near_local?schema=public'
$env:CHAIN = 'near'
$env:NEAR_APP_ORIGIN = 'http://localhost:5173'
$env:NEAR_NETWORK = 'testnet'
npm.cmd start
```

These commands are for a fresh read-only installation: do not configure executor credentials or paid copilot keys yet. A pre-existing backend/.env may enable those operator features; use the separate configured-operator guide instead. Never print DATABASE_URL or share database.json. SetupOnly has already applied the migration: do not apply it again.

 Follow [backend startup](docs/NEAR_BACKEND_SETUP.md#runtime-and-startup) to set local DATABASE_URL, CHAIN=near and NEAR_APP_ORIGIN=http://localhost:5173, then npm.cmd start. Apply the additive Near* migration **once only**: skip migration if SetupOnly already applied it. No executor credential is needed for read-only mode. Health **http://127.0.0.1:8787/health** should report near/testnet/identityEnforced:true and signingEnabled:false without an executor. Backend root404 is normal.

The full start-near-local.ps1 helper requires existing operator executor metadata/credential setup: it is **not** a fresh one-command installation. Keep API and Vite terminals open. Initial build generates Prisma; do not regenerate its Windows DLL while API is running. Frontend API defaults to http://127.0.0.1:8787; override via VITE_NEAR_API_URL, not legacy VITE_API_URL.

### C. Fresh signed demo: explicit operator setup

Follow [first run](docs/NEAR_FIRST_RUN.md), [executor setup](docs/NEAR_BACKEND_SETUP.md) and [browser walkthrough](docs/NEAR_BROWSER_DEMO.md). Executor owner separately installs a FunctionCall key; never substitute a FullAccess key. Reviewed demo defaults: storage0.05 NEAR, initial principal0.1 NEAR, grant cap0.05/max3/only approved payee/1-8 hour expiry. Refresh a funded owner's ledger; never repeat initial funding to inspect history.

Historical grants are revoked/expired: inspect their receipts without renewing them. Uncertain submissions keep the same intent/withdrawal ID and packet/hash. Do not clear localStorage, reset keys or generate replacement payments to bypass pending state. [Withdrawal review and recovery](docs/NEAR_BROWSER_WITHDRAWAL.md).

Gemini is optional, disabled by default: [configuration, consent and limitations](docs/NEAR_COPILOT_LLM.md). It cannot sign or override a contract verdict. Basic reproduction needs no paid model calls.

## Verified Testnet transactions

Vault: [nhat-redline-vault.testnet](https://explorer.testnet.near.org/accounts/nhat-redline-vault.testnet). Browser owner nhat-redline-web.testnet; executor nhat-redline-agent.testnet; payee nhat-redline-payee.testnet.

| Case | Public receipt |
| --- | --- |
| ALLOW0.01, settled callback | [ALLOW](https://explorer.testnet.near.org/transactions/6dQsYKnAqx3y5bQYwSHD3LeVktSpMiKSnX9LLV6VRZoe) |
| Spend cap exceeded | [REJECT cap](https://explorer.testnet.near.org/transactions/CX71RxEViVW2xrVxQBtELiPNic8NwCMchoxwxhvfymtX) |
| Recipient not allowed | [REJECT recipient](https://explorer.testnet.near.org/transactions/GympRgkPjYkNLa6NTDp6eaALgh5hTiHnhNi6T7PYJ5pX) |
| Nonce replay | [REJECT replay](https://explorer.testnet.near.org/transactions/9LdgMWE3aE7PJ3vHa9veApZ6yFdRstVfwKRPdS9fdV1w) |
| After revoke | [REJECT revoked](https://explorer.testnet.near.org/transactions/FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP) |
| Browser withdrawal0.01 | [Withdrawal](https://explorer.testnet.near.org/transactions/AwCQh5ceQyom6WM46TkmaDdJG2AFBFQwvvcu8KrWcMHp) |

[Full proof matrix](docs/NEAR_BROWSER_DEMO.md) | [Raw receipts](docs/TESTNET_PROOF.md) | [Read-only withdrawal verifier](backend/scripts/verify-near-web-withdrawal.ts).

Receipts independently verified using public RPC; browser clicks owner-observed, not automated wallet E2E. Pinned FINAL block276474423 on2026-11-06 showed available0.08/storage0.04404/pending withdrawals0. This is a historical snapshot, not today's balance promise.

## Reproduce checks

```powershell
# Root: frontend tests/typecheck/build
npm.cmd run check
# Backend, after npm ci and initial Prisma generation
Set-Location backend
npm.cmd test
npm.cmd run typecheck
npx.cmd tsc -p tsconfig.json
```

2026-11-10 isolated Git-source/cache installation:428 frontend/632 backend tests plus typechecks/builds PASS ([report](docs/evidence/phase6-clean-report.json)).26 isolated Postgres integration tests passed at an earlier checkpoint; newest logo CSS change passed frontend typecheck/build. Counts and dates are evidence checkpoints, not promises of today's clean install. [Actual test scope/logs](docs/NEAR_FUNCTIONAL_SECURITY_CHECKPOINT.md).

- [Contract reproduction](contracts/near-safety-vault/tests/README.md):21 SDK tests and prior real sandbox53 transactions/136 receipts; local sandbox proof is distinct from public Testnet.
- [Source/cache installation](scripts/check-near-clean-install.ps1): isolated install/tests/build without local credentials or server; not independent online newcomer acceptance.
- python scripts/scan-secrets.py scans configured patterns in locally reachable Git history/index; no matched values printed. It does not guarantee absence of all secrets.
- Hosted NEAR CI at commit51764fd passed: [frontend](https://github.com/MinhNhat-2504/redline-near-guardrails/actions/runs/42718065422), [backend/Postgres](https://github.com/MinhNhat-2504/redline-near-guardrails/actions/runs/42718065531), [contract/sandbox](https://github.com/MinhNhat-2504/redline-near-guardrails/actions/runs/42718065511). Later documentation-only commits are not claimed to have separate same-SHA runs.

## New work versus inherited work

| Path | Provenance |
| --- | --- |
| contracts/near-safety-vault/ | New Rust vault, policies, reservation/callback/withdrawal safety and sandbox tests. |
| backend/src/near/, backend/src/chain/near.ts | New NEAR auth/RPC/scoped execution/durable journal/reconciliation/Policy Lab/Gemini adapter. |
| backend/prisma/near-migrations/ | Additive Near* tables, no destructive startup migration. |
| src/near/ | New NEAR wallet/workspace/review/recovery/proofs/history. Existing REDLINE visual assets/palette reused. |
| Original src/app/, Solana program, legacy backend | Preserved REDLINE. Marketplace/USDC/Solana features are not re-labelled NEAR. |

Full Git history retained at import baseline aa0b0b044d9b6e01b71a14791ec68b24385e098b. Compare new work with:

```text
git diff aa0b0b044d9b6e01b71a14791ec68b24385e098b..HEAD -- contracts/near-safety-vault backend/src/near src/near
```

[Reuse inventory](docs/REUSED_COMPONENTS.md) | [Inherited README](README_SOLANA.md).

## Limits and submission readiness

- Testnet only, no professional audit/insurance/Mainnet readiness guarantee. Privileged contract/account keys and upgrade rights remain trust boundaries.
- Local API/Postgres/executor setup required for new signed demonstrations. No hosted NEAR deployment claimed; judges need a video and reproducible runbook.
- Public RPC can throttle/prune/error; uncertainty keeps checkpoints/reservations and may require operator investigation, not automatic unlock.
- localStorage is not an atomic cross-tab lock; avoid parallel funding/withdrawal tabs. Callback liveness and immutable record growth remain operational limits.
- History is a scoped journal (up to100 rows/query), not a complete account indexer. Old storage receipts may lack identifying detail.
- Mobile/automated real-wallet E2E and interrupted post-signing recovery remain incomplete. One Gemini response does not establish provider reliability.
- Owner confirmed permission to publish inherited work. MIT approved for new individually owned NEAR contributions only; inherited and third-party terms remain separate. Public main access and NEAR CI are verified at the documented checkpoints. X demo post and submission confirmation remain outstanding.

## Credits and licensing

**Independent NEAR project: Trịnh Ngọc Minh Nhật.** The new project is not submitted as a CSaCLAB team entry. Original REDLINE author credits are retained solely as source attribution in [ATTRIBUTIONS.md](ATTRIBUTIONS.md) and [README_SOLANA.md](README_SOLANA.md); they do not imply participation in the new NEAR project. Sources: [preserved REDLINE import](https://github.com/MinhNhat-2504/REDLINE) and [original credited repository](https://github.com/NguyenPhong2912/REDLINE).

NEAR migration maintained in MinhNhat-2504/redline-near-guardrails. Inherited work is not claimed as new hackathon work. [Third-party notices](ATTRIBUTIONS.md) remain. New individually owned NEAR contributions use [MIT](LICENSE), subject to [license scope](LICENSE_SCOPE.md). Inherited REDLINE and third-party work are not relicensed. [Publication review](docs/NEAR_PUBLICATION_REVIEW.md).
