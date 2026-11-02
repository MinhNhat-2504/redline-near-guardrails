# Public NEAR Testnet proof — NOT DEPLOYED

Phase 2 is blocked on dedicated account selection, secure signing setup and owner authorization/signatures. Phase 1's local tests are complete; they are not public Testnet evidence.

| Item | Verified state |
| --- | --- |
| Testnet contract account | NOT SET / NOT DEPLOYED |
| Owner / executor / recipient accounts | NOT SELECTED |
| Deployment / ALLOW / REJECT / revoke transaction hashes | NONE |
| Public receipts / explorer links | NONE |
| Built artifact available locally | SHA-256 `ae5e7a073b97f1834f245adf74e7a4ac0b1baf6d9f5248cabb7120a55b6c2524` |
| Public RPC status query | Protocol 88 / nearcore 2.14.0-rc.5, read-only evidence in `evidence/phase1-testnet-runtime.json` |

Before deployment the owner must identify dedicated **Testnet** contract, owner, executor and recipient account IDs, establish their local wallet/keystore signing flow and approve who retains the contract deployment/upgrade key. The executor must never receive the owner's or contract's full-access key. Each spending owner and executor separately registers/funds its storage allowance; contract account needs deployment storage stake and the documented operating reserve.

Do not paste private keys into chat or commit them. Continue with Testnet account setup and signed deployment only after this boundary is resolved. Then run owner deposit/grant, valid agent transfer, cap/recipient deny and revoke, query finalized callbacks/balances, and attach actual public explorer links with artifact hash and deployment version. No mainnet activity is needed for this MVP.
