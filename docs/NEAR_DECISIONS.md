# NEAR engineering decisions

## 2026-11-03 — baseline and boundaries

- Preserve the entire original Git history. Existing nonempty workspace held only user-supplied Markdown/PDF, so clone into `.source-import`, check name collisions, then move tracked source and `.git` into root. Develop on `feat/near-mvp`; origin is the new NEAR repository.
- Preserve the original application and Anchor workspace. NEAR contract will be an isolated crate with its own workspace/lockfile so Anchor's dependency graph does not change.
- Consulted official docs: https://docs.near.org/smart-contracts/anatomy/crosscontract and https://docs.rs/near-sdk/latest/near_sdk/ . The latter resolves to **5.30.0** at lookup. Do not blindly copy its older 5.17 quickstart dependency example. Final SDK pin and toolchain must be validated by actual build.
- Official NEAR docs confirm calls/callbacks are independent; no automatic rollback across receipts. Reserve both owner funds and grant transaction slots before creating Promise. Callback success finalizes; failure releases once. Revoke cannot cancel queued transfers. No timeout release.
- MVP: native NEAR only; u128 yoctoNEAR and decimal strings in JSON. Use predecessor authority; signer identity alone cannot authorize calls through a hostile contract. Owner-signed policy parameters remain on-chain authority.
- Storage must be funded separately from transferable owner credit. Bound IDs/allowlists; charge actual storage growth. Callback state updates must not require new owner storage funding. Low callback gas/stuck pending must fail closed.
- Sandbox is local NEAR runtime evidence, distinct from SDK mock environment tests and from public Testnet proof. Never treat any one as another.
- Windows Rust absent; Ubuntu WSL available but no Rust either. Any locally prepared toolchain stays under ignored `.tooling/`, without modifying shell profiles.
- `nearhackathon.com/HACKATHON.md` could not be read by web tool (unsupported Markdown content-type). Event rules/deadline in supplied documents remain unverified live; do not treat them as confirmed by this session.
