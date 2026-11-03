# Public NEAR Testnet proof — DEPLOYED, demo verification pending

Phase 2 is PARTIAL. The user created four dedicated accounts and signed deployment plus `new` using the vault account's local CLI keychain. Deployment, initialized state and code identity have been independently verified through finalized public RPC reads. No agent transfer/deny proof exists yet; the complete Phase 2 gate is not passed.

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
| ALLOW / REJECT / revoke / withdrawal proof | NOT RUN yet |
| Built artifact available locally | SHA-256 `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524` |
| Public RPC status query | Protocol 88 / nearcore 2.14.0-rc.5, read-only evidence in `evidence/phase1-testnet-runtime.json` |

[Deployment transaction](https://explorer.testnet.near.org/transactions/F4tTGzL13zDRtWxpgkUod41PQnbkb5XGvLU9eArSiNor). Raw RPC evidence: `evidence/phase2-deploy.json`, `phase2-account.json`, `phase2-state.json`. The initialized state was read, not inferred solely from the submitted transaction.

Signing remains with the user's local CLI keychain. No private key was read by the agent or committed. The executor must never receive the owner's or contract's full-access key. Each spending owner and executor separately registers/funds its storage allowance.

Funding is verified, not just inferred from screenshots: each transaction was checked for FINAL/success, signer, receiver, method and exact attached deposit. Finalized ledger views independently confirm the amounts at blocks 275994641/275994650. Raw evidence: `evidence/phase2-{owner-storage,agent-storage,owner-deposit,owner-balance,agent-balance,funding-verification}.json`. Storage allowances are separate and currently non-refundable; principal remains tracked separately.

Next: the user reviews/signs a grant, then valid transfer, cap/recipient deny, revoke and available-only withdrawal. `scripts/prepare-near-testnet-grant.ps1` prepares an **unsigned** proposal: total spend 0.2 native NEAR, max three transfers including pending, executor `nhat-redline-agent.testnet`, only recipient `nhat-redline-payee.testnet`, cooldown zero, expiry one hour after preparation (configurable 1–24 hours). It performs no RPC/signing. Each run preserves a unique package under ignored `.tooling/near-testnet/`; use its latest-grant-path.txt pointer for CLI file-args. Initial proposal snapshot is in `evidence/phase2-proposed-{grant,policy-canonical}.json`; it is not an on-chain grant or proof of permission. Regenerating changes ID/expiry/hash; verify the actual signed package against the resulting on-chain grant.

Grant authorization, transfer/deny/revoke/withdraw remain NOT RUN. Do not rerun deposits blindly. No mainnet activity is needed.
