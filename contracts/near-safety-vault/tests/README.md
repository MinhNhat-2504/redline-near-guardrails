# Reproduce local NEAR verification

Linux (or Ubuntu WSL), C/C++ compiler, Python 3 with `cryptography`, and Rust 1.99.1 are required. This creates **local sandbox accounts only**, with generated keys under ignored `.tooling/`; no Testnet wallet or credentials are needed. Missing prerequisites or failures exit nonzero.

From the repository root:

```sh
rustup toolchain install 1.99.1 --profile minimal --component rustfmt,clippy --target wasm32-unknown-unknown
cargo +1.99.1 fmt --manifest-path contracts/near-safety-vault/Cargo.toml --check
cargo +1.99.1 test --manifest-path contracts/near-safety-vault/Cargo.toml --locked --lib
cargo +1.99.1 clippy --manifest-path contracts/near-safety-vault/Cargo.toml --locked --all-targets -- -D warnings
cargo +1.99.1 build --manifest-path contracts/near-safety-vault/Cargo.toml --locked --target wasm32-unknown-unknown --release
mkdir -p .tooling docs/evidence
curl --fail --location --retry 3 https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/Linux-x86_64/2.14.0-rc.5/near-sandbox.tar.gz -o .tooling/sandbox.tar.gz
echo '11ff20219d0a3847ee85f14232d169072a0e105f744dc6ab9d587efbbded0a5e  .tooling/sandbox.tar.gz' | sha256sum --check
tar -xzf .tooling/sandbox.tar.gz -C .tooling
/usr/bin/python3 contracts/near-safety-vault/tests/sandbox.py \
  --binary .tooling/Linux-x86_64/near-sandbox \
  --wasm contracts/near-safety-vault/target/wasm32-unknown-unknown/release/redline_safety_vault.wasm \
  --evidence docs/evidence/local-sandbox.json
```

On Ubuntu, `sudo apt-get install build-essential python3-cryptography` supplies the native compiler and Ed25519 dependency. For WSL performance put Cargo caches/build directories on its Linux filesystem rather than `/mnt/c` or `/mnt/d`; if using `CARGO_TARGET_DIR`, point `--wasm` to that directory's artifact.

**Compatibility matters:** near-sdk 5.30.0 declares minimum protocol 88. Public Testnet status queried 2026-11-03 reported protocol 88 / nearcore 2.14.0-rc.5; the matching sandbox binary above is pinned. npm near-sandbox 0.3.4's default binary 2.13.4 supports only protocol 86 and rejected this WASM's host imports. The failed attempt is retained as evidence; it is not counted as a passing test.

Build from the repository root: `.cargo/config.toml` supplies `--cfg near` **only for the WASM target**, as required by near-sdk-env 0.1.8 for NEAR host hashing/panic behavior. The contract intentionally refuses WASM compilation without this flag. Do not override its target rustflags with a generic `RUSTFLAGS` environment variable. Native unit tests and the inherited Solana targets do not receive this target-specific cfg.

The script submits each signed transaction through `send_tx` until INCLUDED, then queries `tx` with `wait_until=FINAL`. It checks actual native recipient balance deltas, policy rejection state, failed transfer receipts plus callback release, revocation, caller rejection, storage payer isolation, concurrent cap enforcement and withdrawal/transfer races. Transaction hashes belong only to the generated local chain; they are not public explorer proofs. Raw receipt outcomes are saved even when a scenario fails. SDK unit tests remain explicitly distinct from this runtime suite.
