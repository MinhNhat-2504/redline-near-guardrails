#!/usr/bin/env bash
# Isolated local NEAR runtime only; never deploys or reads a wallet credential.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -ne 2 ]]; then
  printf 'Usage: bash scripts/verify-near-local-security.sh <near-sandbox-binary> <new-evidence.json>\n' >&2
  exit 2
fi
if [[ ! -x "$1" || -e "$2" ]]; then
  printf 'Require an executable local sandbox and a new evidence path.\n' >&2
  exit 2
fi
manifest=contracts/near-safety-vault/Cargo.toml
cargo fmt --manifest-path "$manifest" --check
cargo test --manifest-path "$manifest" --locked --lib
cargo clippy --manifest-path "$manifest" --locked --all-targets -- -D warnings
cargo build --manifest-path "$manifest" --locked --target wasm32-unknown-unknown --release
wasm="${CARGO_TARGET_DIR:-contracts/near-safety-vault/target}/wasm32-unknown-unknown/release/redline_safety_vault.wasm"
sha256sum "$wasm"
/usr/bin/python3 contracts/near-safety-vault/tests/sandbox.py --binary "$1" --wasm "$wasm" --evidence "$2"
