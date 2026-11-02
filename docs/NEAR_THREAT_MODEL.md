# NEAR vault threat model (implementation review in progress)

Scope: isolated native NEAR Testnet prototype. No independent audit, token transfers, swaps, marketplace payments, mainnet or backend NEAR authentication is claimed.

| Threat | Implementation control | Required evidence |
| --- | --- | --- |
| Executor impersonation through signer forwarding | Match predecessor to immutable executor | Unit spoofing test and sandbox failed receipt |
| Another owner spends/revokes/withdraws funds | Owner identity derived from direct signed caller; ledger by AccountId; revoke checks stored owner | Two-owner tests |
| Concurrent cap bypass | Reserve amount/slot before Promise; all cap checks include pending | Unit interleaving + sandbox concurrent requests |
| Replay on retry | Intent ID tombstone; consumed nonce never restored | Pending/settled/failed replay tests |
| Spoofed/double callback | Private export + explicit self-predecessor; exactly one promise result; transition only PENDING | Sandbox auth rejection; SDK result tests |
| Transfer failure | Callback releases reservation once, leaves nonce consumed | Missing long-form recipient receipt failure + balances |
| Revoke during pending | Stop new intents, settle queued ones | Unit interleaving and sandbox revoke |
| Withdraw races pending transfer | Separate pending withdrawals and outgoing amount reservation | Unit/sandbox balance invariants |
| Storage drains principal or locks another owner | Separate allowances; owner pays grants/withdrawals, executor pays its intents (including denials); actual storage growth charge, bounded IDs/allowlist | Insufficient allowance rollback and owner storage unchanged on denials |
| Callback runs out of storage | Fixed-size persisted callback transitions, no new records | Storage usage and real callbacks |
| Insufficient callback gas/liquidity | Minimum remaining call gas; callback fixed allocation; physical storage/operating buffer check | Low gas/liquid reserve tests |
| Lost callback / RPC timeout | Leave reservation locked; observe on-chain state, no timeout unlock | Pending view and documented limitation |
| Fraudulent proof | Distinguish policy REJECTED in successful receipt from runtime panic; attach real outcomes only | Sandbox transcript; later Testnet explorer links |

Open limitations: global grant IDs can be squatted (use random IDs); executor must fund/register its own non-refundable storage allowance; direct owner calls only; no repair for stuck callbacks; immutable on-chain record retention grows storage; a contract account full-access key/deployment upgrade can replace all controls and must be secured before Testnet deployment. Backend database, owner wallet UX and NEAR event reconciliation are later phases.

Do not use the inherited Solana `tx?.meta?.err ?? null` success fallback or the inherited no-API-key auth bypass for NEAR. Neither is a valid trust boundary.
