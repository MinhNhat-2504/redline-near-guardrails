# Public NEAR Testnet proof — DEPLOYED, demo verification pending

Phase 2 is PARTIAL. The user created four dedicated accounts and signed deployment plus `new` using the vault account's local CLI keychain. Deployment, initialized state and code identity have been independently verified through finalized public RPC reads. The first agent transfer is now verified; recipient denial/revoke/withdraw proofs remain pending and the complete Phase 2 gate is not passed.

| Item | Verified state |
| --- | --- |
| Testnet contract account | `nhat-redline-vault.testnet` |
| Owner | `nhat-redline-owner.testnet` |
| Executor | `nhat-redline-agent.testnet` |
| Recipient | `nhat-redline-payee.testnet` |
| Deployment + `new` transaction | `F4tTGzL13zDRtWxpgkUod41PQnbkb5XGvLU9eArSiNor` |
| Final execution status | `FINAL`, `SuccessValue: ""`, two receipt outcomes |
| On-chain code hash (base58 SHA-256) | `CjfViNvnk8rzPnpPeT5Wv37GA9jc92m5A47RfJHQyodM` — verified equal to local WASM digest |
| Initialized state | `STATE` present at finalized block 275991839 |
| Owner storage 0.05 NEAR | `5r7ctMmfhMwZre6hhE1UdyP1ecU9uCJfLK5zWLdjJaEV` — FINAL/success |
| Executor storage 0.05 NEAR | `Aa9zY4vC5yGFxKdePfGZchqfocvcxCT7ZT2XxZeBTxSR` — FINAL/success |
| Owner principal deposit 0.5 NEAR | `93dMm1H8qBKFiuE5mY76GMbufYoymLH6H9HVqT93B7Pc` — FINAL/success |
| Owner ledger after funding | credited 0.5 NEAR; spent/pending/withdrawals zero; storage remaining 0.04833 NEAR |
| Executor ledger after funding | credited zero; storage remaining 0.04833 NEAR |
| ALLOW transfer | FINAL; intent SETTLED/OK; payee +0.05 NEAR |
| Cap REJECT | FINAL; REJECTED/SPEND_CAP_EXCEEDED; no payout |
| Recipient REJECT / revoke / withdrawal proof | NOT RUN yet |
| Built artifact available locally | SHA-256 `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524` |
| Public RPC status query | Protocol 88 / nearcore 2.14.0-rc.5, read-only evidence in `evidence/phase1-testnet-runtime.json` |

[Deployment transaction](https://explorer.testnet.near.org/transactions/F4tTGzL13zDRtWxpgkUod41PQnbkb5XGvLU9eArSiNor). Raw RPC evidence: `evidence/phase2-deploy.json`, `phase2-account.json`, `phase2-state.json`. The initialized state was read, not inferred solely from the submitted transaction.

Signing remains with the user's local CLI keychain. No private key was read by the agent or committed. The executor must never receive the owner's or contract's full-access key. Each spending owner and executor separately registers/funds its storage allowance.

Funding is verified, not just inferred from screenshots: each transaction was checked for FINAL/success, signer, receiver, method and exact attached deposit. Finalized ledger views independently confirm the amounts at blocks 275994641/275994650. Raw evidence: `evidence/phase2-{owner-storage,agent-storage,owner-deposit,owner-balance,agent-balance,funding-verification}.json`. Storage allowances are separate and currently non-refundable; principal remains tracked separately.

Grant authorization and the first valid transfer are verified; next: cap/recipient deny, revoke and available-only withdrawal. `scripts/prepare-near-testnet-grant.ps1` prepares an **unsigned** proposal: total spend 0.2 native NEAR, max three transfers including pending, executor `nhat-redline-agent.testnet`, only recipient `nhat-redline-payee.testnet`, cooldown zero, expiry one hour after preparation (configurable 1–24 hours). It performs no RPC/signing. Each run preserves a unique package under ignored `.tooling/near-testnet/`; use its latest-grant-path.txt pointer for CLI file-args. Initial proposal snapshot is in `evidence/phase2-proposed-{grant,policy-canonical}.json`; it is not an on-chain grant or proof of permission. Regenerating changes ID/expiry/hash; verify the actual signed package against the resulting on-chain grant.

Grant authorization is FINAL/success: `9guZzifgUg7ZJHcWK8pfLM2ruyUAV5qw2YVJTnRisQAp`, ID `demo-86a101943e5f425e9376a1de84ed66cf`. Raw transaction arguments, local signed package, canonical hash and finalized active policy match. Nonce 0; spend/pending zero. See `evidence/phase2-grant-verification.json`. The signed canonical bytes are retained separately from the initial unsigned proposal.

Prepared first transfer: 0.05 NEAR to payee, nonce 0, persistent intent ID; `evidence/phase2-safe-transfer-args.json` is **UNSIGNED / NOT SUBMITTED**. Payee baseline: 10 NEAR at finalized block 275995678. Grant expires 2026-11-03 11:53:39 UTC+7. This prepared transfer was subsequently submitted and verified below; deny/revoke/withdraw remain NOT RUN. Do not rerun deposits blindly. No mainnet activity is needed.

## First ALLOW transfer ? verified

Transaction [`3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1`](https://explorer.testnet.near.org/transactions/3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1) is FINAL. Signer is agent, receiver vault, arguments exactly match the prepared file. All six receipt outcomes succeeded; callback and finalized intent are SETTLED/OK. Payee balance increased from 10 to 10.05 NEAR, exactly the requested 0.05 NEAR. Grant spent 0.05 NEAR, count 1, next nonce 1, pending zero; owner available principal 0.45 NEAR.

Raw receipts and finalized views are retained in `evidence/phase2-{safe-transfer,safe-intent,grant-after-safe,owner-after-safe,payee-after-safe}.json`; `phase2-safe-transfer-verification.json` records the independent assertions. Previously unsigned snapshots remain historical preparation evidence. Negative attempt files `phase2-transfer-deny-cap.json` and `phase2-transfer-deny-recipient.json` are unsigned proposals only. No contract/application changes or new build results are claimed at this checkpoint.

## Cap denial ? verified

Transaction [`J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x`](https://explorer.testnet.near.org/transactions/J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x) is FINAL with successful contract execution returning REJECTED/SPEND_CAP_EXCEEDED. The attempted 0.16 NEAR exceeds the remaining 0.15 NEAR. Exact signed args match the prepared proposal; finalized intent agrees with the return value. Both receipt outcomes succeeded, with no receipt to payee. Finalized grant and owner ledger are identical to the post-ALLOW snapshot; payee remains 10.05 NEAR, nonce remains 1, pending zero.

Independent assertions and raw responses: `evidence/phase2-{cap-denial,cap-denied-intent,grant-after-cap-denial,owner-after-cap-denial,payee-after-cap-denial,cap-denial-verification}.json`. Cap-denial proposal has now been submitted; recipient-denial proposal remains unsigned. Phase 2 stays PARTIAL until outstanding checks are completed.
