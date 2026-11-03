# Public NEAR Testnet proof - Phase 2 PASS

Verified 2026-11-03 (UTC+7) using finalized public RPC responses, not screenshots alone. Phase 2 contract/Testnet gate is PASS. Backend and frontend NEAR integration remain pending; this does not claim a complete application or professional audit.

Contract: `nhat-redline-vault.testnet`. Owner: `nhat-redline-owner.testnet`. Executor: `nhat-redline-agent.testnet`. Recipient: `nhat-redline-payee.testnet`.

Sandbox-tested and rebuilt WASM SHA-256: `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524`. Deployment code hash: `CjfViNvnk8rzPnpPeT5Wv37GA9jc92m5A47RfJHQyodM` (same digest). Deploy/init and initialized STATE evidence: `evidence/phase2-{deploy,account,state}.json`.

## Actual transactions

| Operation | Public explorer | Verified result |
| --- | --- | --- |
| Deploy + initialize | [F4tTGzL13zDRtWxpgkUod41PQnbkb5XGvLU9eArSiNor](https://explorer.testnet.near.org/transactions/F4tTGzL13zDRtWxpgkUod41PQnbkb5XGvLU9eArSiNor) | FINAL / success; code hash matched |
| Owner storage | [5r7ctMmfhMwZre6hhE1UdyP1ecU9uCJfLK5zWLdjJaEV](https://explorer.testnet.near.org/transactions/5r7ctMmfhMwZre6hhE1UdyP1ecU9uCJfLK5zWLdjJaEV) | FINAL / success; 0.05 NEAR |
| Executor storage | [Aa9zY4vC5yGFxKdePfGZchqfocvcxCT7ZT2XxZeBTxSR](https://explorer.testnet.near.org/transactions/Aa9zY4vC5yGFxKdePfGZchqfocvcxCT7ZT2XxZeBTxSR) | FINAL / success; 0.05 NEAR |
| Owner principal | [93dMm1H8qBKFiuE5mY76GMbufYoymLH6H9HVqT93B7Pc](https://explorer.testnet.near.org/transactions/93dMm1H8qBKFiuE5mY76GMbufYoymLH6H9HVqT93B7Pc) | FINAL / success; 0.5 NEAR |
| Create grant | [9guZzifgUg7ZJHcWK8pfLM2ruyUAV5qw2YVJTnRisQAp](https://explorer.testnet.near.org/transactions/9guZzifgUg7ZJHcWK8pfLM2ruyUAV5qw2YVJTnRisQAp) | FINAL / active at creation; canonical hash matched |
| ALLOW | [3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1](https://explorer.testnet.near.org/transactions/3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1) | FINAL / SETTLED; payee +0.05 NEAR |
| Cap deny | [J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x](https://explorer.testnet.near.org/transactions/J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x) | FINAL / REJECTED / SPEND_CAP_EXCEEDED |
| Recipient deny | [8MCrqH1rQXTPvfuG6Yk9TuAVXgGo7mj55rmfMvNL9DuB](https://explorer.testnet.near.org/transactions/8MCrqH1rQXTPvfuG6Yk9TuAVXgGo7mj55rmfMvNL9DuB) | FINAL / REJECTED / DESTINATION_NOT_ALLOWED |
| Revoke | [C2tYedjVQycHtCovMXTGr75DLWbmRNawLjkwnSxobCEU](https://explorer.testnet.near.org/transactions/C2tYedjVQycHtCovMXTGr75DLWbmRNawLjkwnSxobCEU) | FINAL / grant_revoked; active=false |
| After-revoke deny | [4huc1hEC2EF3jEft21Ga7xBvoFMCuvzsCTsiLWJkGBU4](https://explorer.testnet.near.org/transactions/4huc1hEC2EF3jEft21Ga7xBvoFMCuvzsCTsiLWJkGBU4) | FINAL / REJECTED / REVOKED |
| Withdraw | [9cvuomo1TKYbT3UiyEeLVCXiqdX6vnuEJaLkWMqA7c5V](https://explorer.testnet.near.org/transactions/9cvuomo1TKYbT3UiyEeLVCXiqdX6vnuEJaLkWMqA7c5V) | FINAL / SETTLED; 0.45 NEAR to owner |

Policy rejections are successful contract executions returning persisted REJECTED intents. They do not mean a runtime failure. Each denial transaction's signer/receiver/method/exact arguments and zero deposit were checked; no receipt executed on its proposed recipient. Grant/intent IDs are retained in the public argument snapshots. The canonical signed policy is `evidence/phase2-signed-grant-canonical.json`; SHA-256 matches the immutable on-chain policy.

## Final reconciliation

| Item | Finalized on-chain state |
| --- | --- |
| Owner credited principal | 0.5 NEAR |
| Finalized spent | 0.05 NEAR |
| Completed withdrawals | 0.45 NEAR |
| Pending transfer / withdrawal principal | 0 / 0 |
| Available principal | 0 |
| Payee | 10 -> 10.05 NEAR; exactly +0.05 |
| Grant | active=false; finalized count 1; next nonce 1; no pending amount/slots |
| Withdrawal | amount 0.45 NEAR, SETTLED |
| Owner storage allowance remaining | 0.04401 NEAR; separate from principal and currently non-refundable |

The withdrawal's owner receipt succeeded and its callback returned SETTLED. Owner wallet gas fees mean the wallet balance delta need not equal the gross withdrawal. Revoke blocks new intents; it cannot cancel already queued promises. `has_reserved=true` is a historical cooldown marker; current reservations are given by pending fields, which are zero.

Final views: `evidence/phase2-{final-grant,final-owner,final-available,final-withdrawal,final-payee,recipient-denied-intent,post-revoke-intent}.json`. New transaction receipts: `phase2-{recipient-denial,revoke,post-revoke-denial,withdraw}.json`; earlier deployment/funding/ALLOW/cap evidence remains retained.

## Reproduce validation

```powershell
python scripts/verify-near-testnet-proof.py
```

Result: PASS, ten distinct funding/grant/transfer/deny/revoke/withdraw transactions checked in addition to the earlier deploy/hash verification. Verifier checks FINAL status, successful receipt outcomes, exact signed arguments, canonical policy binding, terminal callback results, stored intents, no recipient receipt on denied calls, ledger conservation and actual payee delta. Saved report: `evidence/phase2-proof-verification.json`. This is consistency checking of collected RPC data, not cryptographic light-client verification; independently re-query the public RPC for provenance/freshness.

The earlier automatic approval usage-limit error prevented collection temporarily. Retrying after the user's continue instruction succeeded; missing data was collected and assertions passed. The former screenshot-only gap is resolved. An initial WSL hash command expanded its environment variable before reaching WSL and failed; explicit verified build-path hashing succeeded and matched the deployed artifact. No failed command was counted as PASS.

Owner signed all owner actions locally; agent signed executor actions locally. No signing keys were read by the coding agent, copied into the backend or committed. Do not repeat funding, grant creation, transfer or withdrawal to reproduce offline verification. The immutable demonstration grant is revoked and expired; a future live demo needs a new owner-reviewed grant.

Unit/regression/build rechecks and exact logs are listed in `TEST_RESULTS.md`. All seven gates and concurrency/failure cases were tested in the real local sandbox in Phase 1; public Testnet specifically proves ALLOW, spend cap, destination, revoke and withdrawal. Public replay/concurrency/failure scenarios were not separately run. GitHub CI execution, live database/API/UI NEAR E2E and independent audit remain NOT RUN.

## Phase 3 API demo preparation: independently verified owner actions

Additional owner deposit0.1 NEAR [transaction](https://explorer.testnet.near.org/transactions/EwAtGZnEMncRqcgFH6PznBiMiVr8opi8wZRjjfzHL5hR) and new grant [transaction](https://explorer.testnet.near.org/transactions/7ELKNpW6W67jpy2FUpzPvUTmkmVfsh1JejzTonVHdMXt) independently verified FINAL with exact arguments and successful receipt outcomes. Grant grant-1a0c71424cd843fc84e1ae1ecfc5f193: cap0.05, max3, only payee, executor agent, active/nonce0/spent0 at finalized snapshot; expiry November3 15:20:16.906 UTC+7. Owner available0.1; payee baseline10.05 native NEAR.

Run `python scripts/verify-near-api-demo-preflight.py` for offline consistency checks; report [phase3-api-preflight-verification.json](evidence/phase3-api-preflight-verification.json). These owner actions do not prove scoped executor API execution. That transfer remains NOT RUN; user steps in [NEAR_API_DEMO_NEXT.md](NEAR_API_DEMO_NEXT.md). Do not repeat deposit/create_grant.

## Phase 3 scoped-key reset and invalidated attempt

API attempt9ZNGTALnybEr2nPgSS8RRKgn29W18eQScoEnqeqoWrkH returned UNKNOWN and later INVALID_TRANSACTION:NotEnoughAllowance. Protocol88 minimum gas purchase price1e9 makes100Tgas alone cost0.1 before fees, exceeding the scoped allowance. New packets use80Tgas; this does not modify the original signed packet or prove successful execution.

User-signed [atomic same-key reset](https://explorer.testnet.near.org/transactions/AzsMwgFkYMpKPGmah47aNjn8nAbv58hK2BrE7fGRoUo7) independently verified FINAL, exact DeleteKey/AddKey, same vault/method/allowance. Reset execution height276023050; finalized key nonce276023048000000 supersedes old276011715000001. [Verification](evidence/phase3-executor-key-reset-verification.json) and [raw public inputs](evidence/phase3-executor-key-reset-inputs.json). On-chain old intent absent and financial baselines unchanged at verification; RPC collection consistency, not a cryptographic light-client proof.

After fresh revalidation and stopped-backend guard, approved local journal maintenance marked the old packet INVALIDATED with finalized=false and no events. Packet/request binding/history/accounting preserved; this is a local disposition, not FAILED/SETTLED on chain. [Maintenance report](evidence/phase3-executor-journal-recovery.json). Original grant expired15:20:16.906 UTC+7; a new owner-reviewed grant is required. No recovered scoped-key80Tgas transfer or full Phase3 completion claimed.

## Recovered grant independently verified

User created new grant grant-5c1326cc5e674f78a82be9fbd26744b2 through [FINAL owner transaction](https://explorer.testnet.near.org/transactions/B9HT5FBGAQdp5xnfS4TsfntJA5B5C2PkwsaERP3vTgG1), retaining principal (no topup). Exact args/event/canonical policy hash and all successful receipt outcomes verified. Cap0.05/max3/payee-only/cooldown0, expires16:57:51.496 UTC+7 November3; active nonce0/counts0 at snapshot. Available0.1 NEAR; payee10.05; scoped allowance0.1 and post-reset key nonce unchanged.

Offline check: `python scripts/verify-near-api-recovery-preflight.py`; [report](evidence/phase3-api-recovery-preflight-verification.json), public RPC inputs/canonical policy alongside it. This verifies the owner grant and pre-transfer baselines, not a recovered executor transfer.80Tgas API execution/callback/ledger/payee proof remain pending; Phase3 PARTIAL.

## Real scoped-key API EXPIRED rejection

[Transaction Gqv1YhjYHr9ZVkLnEscPmHFSAWDZ5TcgHhCUxvPPmxGQ](https://explorer.testnet.near.org/transactions/Gqv1YhjYHr9ZVkLnEscPmHFSAWDZ5TcgHhCUxvPPmxGQ) is FINAL, agent signer with installed scoped public key9hau..., execute_transfer80Tgas/deposit0. Returned/stored intent and vault event agree REJECTED/EXPIRED. Vault block276034591 executed17:09:29.167770251 UTC+7, after16:57:51.496 expiry. No payee receipt or pending/completed event; principal available0.1 and payee10.05 unchanged. Gas/intent-storage costs still incurred.

Offline verification using production parser: `cd backend; npx tsx scripts/verify-near-api-expired.ts`. [Report](evidence/phase3-api-expired-verification.json), full actual RPC inputs phase3-api-expired-*.json. Current key allowance0.0997350360765734; no key reset/principal topup required. This proves real scoped-key API REJECT execution. A successful ALLOW/SETTLED transfer and full Phase3 gate remain pending.

## Owner-reviewed renewal FINAL

[Transaction H7FJXLjXkFC9NsD8JdxoSB6i2CxsSMULBD9vKv7K17Az](https://explorer.testnet.near.org/transactions/H7FJXLjXkFC9NsD8JdxoSB6i2CxsSMULBD9vKv7K17Az) creates grant-c6acee2055d848febbdafce9eba0ed49. FINAL/exact owner args/event/canonical policy verified; cap0.05/max3/payee-only, expiry18:34:49.317 UTC+7 November3. Active nonce0/counters0 at baseline; available0.1/payee10.05, scoped key allowance0.0997350360765734/nonce276023048000001. No topup/reset repeated.

Offline `python scripts/verify-near-api-recovery-preflight.py --renewed-grant` PASS; [report](evidence/phase3-api-renewal-preflight-verification.json) and separate public RPC/canonical files. This proves renewed owner authorization/baselines, not a settled executor transfer. Phase3 remains PARTIAL.
# Phase3 signed eight-hour grant preflight — 2026-11-03

Owner create_grant transaction [3q9hhGTRCS3UNn2V3PZndzzzsxYgYPnZD7vPKUzT147R](https://explorer.testnet.near.org/transactions/3q9hhGTRCS3UNn2V3PZndzzzsxYgYPnZD7vPKUzT147R) independently verified FINAL/CONFIRMED against exact public canonical policy and vault event/arguments. Grant `grant-fed48ec7b5db4ba59fe224d9f807d64f`, cap0.05nativeNEAR/max3/only approved payee, deadline03:46:11.164 UTC+7 Nov4; active nonce0/counters0. Owner available0.1NEAR, scoped keynonce276023048000001. Evidence `phase3-eight-hour-signed-{inputs,verification}.json`. This is pre-transfer proof: scoped API0.01 ALLOW/SETTLED remains pending. Historical Phase2 and API EXPIRED evidence below retain their original scope.
# Phase3 scoped API ALLOW — independently verified FINAL

[Transaction GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ](https://explorer.testnet.near.org/transactions/GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ) transferred **0.01 nativeNEAR** from vault to approved payee through the real scoped executor API. Exact key9hau…, execute_transfer80Tgas/zero attached deposit, stable intent `api-safe-517314f69acd437e8b01bfeba3fd45a8`/nonce0/policy and successful callback verified. Six receipt outcomes; stored intent and completed event SETTLED/OK. Public API response hash/fields independently matched the RPC result.

| Field | BEFORE | AFTER |
| --- | --- | --- |
| Payee NEAR | 10.05 | 10.06 |
| Owner available principal | 0.1 | 0.09 |
| Owner finalized spend | 0.05 | 0.06 |
| Grant finalized spend | 0 | 0.01 |
| Grant finalized count / next nonce | 0 / 0 | 1 / 1 |
| Owner/grant pending reserved | 0 | 0 |

Inputs: `phase3-api-allow-before.json`, `phase3-api-allow-after.json`, immutable copied `phase3-api-allow-api-response.json`; report `phase3-api-allow-verification.json`. Reproduce the public-data consistency verifier from backend: `npx.cmd tsx scripts/capture-near-allow-proof.ts verify ../docs/evidence/phase3-api-allow-before.json ../docs/evidence/phase3-api-allow-after.json`. Not a light-client proof or browser E2E. Phase3 MVP gate PASS; browser/signature/replay demonstration and release gates still incomplete.
