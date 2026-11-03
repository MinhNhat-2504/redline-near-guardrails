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
| ALLOW / REJECT / revoke / withdrawal proof | NOT RUN yet |
| Built artifact available locally | SHA-256 `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524` |
| Public RPC status query | Protocol 88 / nearcore 2.14.0-rc.5, read-only evidence in `evidence/phase1-testnet-runtime.json` |

[Deployment transaction](https://explorer.testnet.near.org/transactions/F4tTGzL13zDRtWxpgkUod41PQnbkb5XGvLU9eArSiNor). Raw RPC evidence: `evidence/phase2-deploy.json`, `phase2-account.json`, `phase2-state.json`. The initialized state was read, not inferred solely from the submitted transaction.

Signing remains with the user's local CLI keychain. No private key was read by the agent or committed. The executor must never receive the owner's or contract's full-access key. Each spending owner and executor separately registers/funds its storage allowance.

Next proposed owner-signed demo amounts: owner storage 0.05 NEAR, executor storage 0.05 NEAR, owner principal deposit 0.5 NEAR (all Testnet). Storage allowances are separate and currently non-refundable; principal is tracked separately and can later be withdrawn subject to reservations. The user must execute/sign these calls before further evidence can be verified. Then prepare a reviewed grant, valid transfer, cap/recipient deny, revoke and available-only withdrawal with finalized receipt/balance proofs. Do not rerun deposits blindly if their outcome is unknown. No mainnet activity is needed.
