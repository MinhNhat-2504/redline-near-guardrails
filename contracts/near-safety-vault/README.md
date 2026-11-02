# NEAR Safety Vault (prototype)

Isolated from the inherited Anchor workspace. Native NEAR only. Verified locally with 21 SDK unit tests and real sandbox receipts; no Testnet deployment yet.

```sh
cargo test --manifest-path contracts/near-safety-vault/Cargo.toml
cargo build --manifest-path contracts/near-safety-vault/Cargo.toml --target wasm32-unknown-unknown --release
```

SDK pinned to 5.30.0, as resolved by the official API docs during implementation. Build/test status is recorded in `../../docs/PROGRESS.md`; the existence of these commands is not evidence they passed.

Minimum NEAR protocol: **88**. See [exact toolchain and sandbox reproduction](tests/README.md), including the sandbox version/checksum matched to the observed Testnet runtime. The older default sandbox from npm is incompatible with this SDK.

Owner flow: `storage_deposit` (payable, separate storage allowance), `deposit` (payable principal), `create_grant`, optionally `revoke_grant`, `withdraw`. The executor must separately register/fund its own `storage_deposit` before creating intents. Owner methods require a direct signed call (`predecessor == signer`); contract owners/relayed owner calls are intentionally outside MVP support. Executor authentication checks **predecessor**, never signer alone. Grant IDs are global immutable IDs: choose unpredictable unique IDs up to 64 ASCII alphanumeric/`-`/`_` characters. IDs cannot be overwritten.

Policies bind an executor, 64-character hex policy digest, native NEAR spend cap, transaction count, 1–4 recipients, expiry and cooldown in nanoseconds. All u128 amounts and u64 nonces/timestamps use JSON decimal strings. Amount > 0, hash and available balance are additional checks beyond the seven gates. No native token mint address, float conversion or six-decimal USDC arithmetic is used.

`execute_transfer` takes `grant_id`, `intent_id`, `nonce`, `asset` (must be `NEAR`), `recipient`, `amount` and `policy_hash`. It reserves owner funds **and** a grant transaction slot before scheduling a native transfer and private callback. The returned Promise waits on the callback. Observe `get_intent` to distinguish PENDING, SETTLED and FAILED; successful submission alone is insufficient.

- Policy denials persist REJECTED intent/events in a successful receipt, with no transfer Promise and no spend/nonce consumption. Reusing an intent ID emits a denial without replacing the original record. A new ID is required to retry an earlier denied proposal.
- Nonce increments only on reservation and is never restored, including failed transfers. Duplicate pending/settled/failed IDs cannot transfer twice.
- Spend and transaction caps include pending reservations. Finalized counters increase only after successful transfer receipt. Cooldown starts at reservation, even if transfer later fails.
- Revoke blocks new requests and leaves pending requests to settle. Withdraw reserves available balance separately, sends only to the owner and has its own private idempotent callback.
- Caller/authentication, storage/gas/physical reserve and invalid-input failures panic: those failed receipts do **not** persist new events or states.
- New grants/withdrawals charge the owner's separate storage allowance at runtime byte cost. **Intent records charge the executor's own allowance**, including rejections, so a compromised/revoked executor cannot exhaust an owner's storage and block withdrawal. No storage refund/pruning is supported yet; revoked grants remain readable. Callback records are fixed-size and need no additional storage payment.
- Contract deployment account must sponsor code/state storage plus an extra 0.1 NEAR liquid operating reserve. Calls queueing funds require at least 60 Tgas remaining and reserve 20 Tgas for the callback; sandbox must validate those budgets before deployment.
- A missing/failed callback leaves funds reserved. No timeout release or privileged balance override exists. Owner can withdraw only funds that are not reserved.

SDK unit tests mock the VM context/Promise results. They are not sandbox execution or Testnet transaction proofs. Tests and public Testnet receipts must be reported separately.
