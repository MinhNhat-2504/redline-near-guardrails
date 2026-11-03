## Verified cause and safe boundary

Actual API error: INVALID_TRANSACTION:NotEnoughAllowance for hash9ZNGTALnybEr2nPgSS8RRKgn29W18eQScoEnqeqoWrkH. Public finalized access key still has allowance100000000000000000000000 (0.1 NEAR), nonce276011715000000, vault-only execute_transfer permission. No depletion proved; adding principal to the vault does not fix access-key allowance.

Public protocol88 config min_gas_purchase_price=1000000000 versus current gas_price=100000000. Therefore100Tgas * minimum purchase price = exactly0.1 NEAR, before positive transaction/receipt fees. This lower bound alone proves100Tgas exceeds the installed allowance once fees are included. The current runtime fee formula purchases receipt gas at max(current gas price, minimum purchase price): [nearcore fee source](https://github.com/near/nearcore/blob/master/core/primitives/src/fees.rs). Saved real RPC inputs phase3-current-protocol-config.json, phase3-current-gas-price.json, phase3-executor-allowance-current.json.

New packets now use80Tgas (minimum contract60Tgas with20Tgas callback), keeping allowance ceiling0.1. Existing signed100Tgas packet is immutable; changing source does not repair it. No automatic re-sign, nonce reset, journal retirement or new request was performed. Historic100Tgas packets remain verifiable/reconcilable; reducing the new gas budget is not evidence of recovery or a public transfer.

## Approved recovery; owner's local signature pending

1. Stop the backend with Ctrl+C before maintenance, preserving database/request/key files.
2. User reviews and signs ONE atomic account-key transaction on nhat-redline-agent.testnet: DeleteKey existing scoped public key, then AddKey the SAME public key with the SAME vault-only execute_transfer permission and allowance0.1 NEAR. No new secret, no FullAccess executor permission, no extra recipient/method, no mainnet. This uses the user's existing agent FullAccess keychain signer; coding agent never accesses it. Only transaction gas is paid; no principal topup.
3. Independently verify FINAL successful outcomes and both exact actions; finalized scoped key nonce must be STRICTLY GREATER than old signed packet nonce276011715000001. If this check fails, STOP. Atomic key reset is intended to raise the key's initial nonce and permanently invalidate the old packet under monotonic nonce rules; do not assume the invalidation without reading proof.
4. Only after verified invalidation, implement/verify explicit journal disposition linked to reset proof. Preserve old hash, packet and audit history; do not label it FAILED/SETTLED on chain or decrement contract accounting. Reconcile contract intent/grant/owner/payee before any new signing. A separate new packet at80Tgas needs a deliberate recovery path; the current automatic same-packet retry cannot do this and must not be edited around manually.
5. User authorizes one recovered0.01 NEAR attempt; verify actual FINAL scoped-key execution/callback/accounting/payee delta. If grant expires first, stop for a fresh owner-reviewed grant; never silently replace it or repeat funding.

The user approved this design in chat. The reviewable transaction proposal is NEAR_EXECUTOR_KEY_RESET_UNSIGNED.json. It remains NOT signed and NOT submitted by the coding agent. Phase3 remains PARTIAL.

## Implemented owner signing boundary

Keep backend stopped. In backend PowerShell:

```powershell
.\scripts\reset-near-executor-key.ps1
.\scripts\reset-near-executor-key.ps1 -SignAndSend
```

Default is review-only. SignAndSend checks local OS listener table (blocks while port8787 is open), Testnet identity, finalized existing scoped key/allowance/nonce, pinned CLI0.30.1; checks listeners again immediately before CLI invocation. It refuses an already advanced nonce to prevent resetting twice. The single CLI command constructs DeleteKey then AddKey atomically with the same key/permission/allowance. Only the USER runs SignAndSend; the coding agent executed CheckCli/--help only, no keychain operation.

After actual success, send only the public transaction ID. The read-only verifier can then run:

```powershell
npx.cmd tsx scripts/verify-near-executor-reset.ts <RESET_TRANSACTION_HASH>
```

It independently queries FINAL reset/results, every execution block, current scoped and FullAccess signing keys, explicit UNKNOWN_TRANSACTION for old hash, absent old intent, unchanged grant nonce/counters/policy and owner/payee financial baselines, with all finalized snapshots at/after reset execution. Only a full pass writes VERIFIED_KEY_RESET_ONLY evidence. It never reads session/wallet/executor secrets or accesses/mutates DB. Expiry is flagged, not replaced automatically.

Keep backend stopped after signing/verifying. Guarded journal disposition and recovered transfer remain dependent work AFTER the real reset proof is available; they have NOT run and are NOT claimed finished. Do not run execute-near-api-demo --submit yet.
