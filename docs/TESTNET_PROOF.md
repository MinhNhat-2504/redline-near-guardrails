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
