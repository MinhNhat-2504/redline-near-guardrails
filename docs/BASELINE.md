# Inherited baseline — 2026-11-03

Source: https://github.com/MinhNhat-2504/REDLINE at `aa0b0b044d9b6e01b71a14791ec68b24385e098b`.
All 359 tracked files and both ancestor commits preserved. Source dates verified with `git log`: 2026-09-24 and **2026-10-28 UTC+7** (the handoff's October 27 refers to UTC).

Environment: Windows/PowerShell, Node v24.14.1, npm 11.11.0. No `.env`, wallet credentials, database or LLM credentials supplied.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm.cmd ci` (root) | PASS; lockfile unchanged | `evidence/phase0-frontend-install.log` |
| `npm.cmd run check` (sandbox) | FAIL: esbuild spawn EPERM; typecheck passed | `evidence/phase0-frontend-check.log` |
| `npm.cmd run check` (outside sandbox) | PASS: typecheck, 163 tests / 23 files, production build | `evidence/phase0-frontend-check-unrestricted.log` |
| `npm.cmd ci` (backend) | PASS; lockfile unchanged | `evidence/phase0-backend-install.log` |
| `npm.cmd run build` (backend) | PASS: Prisma generation + tsc | `evidence/phase0-backend-build.log` |
| `npm.cmd run typecheck` (backend) | PASS | `evidence/phase0-backend-typecheck.log` |
| `npm.cmd test` (backend) | PASS: 284 tests / 28 files | `evidence/phase0-backend-test.log` |
| `npm.cmd audit --json` (both) | FAIL: frontend 6 (3 moderate, 3 high); backend 7 (2 moderate, 5 high) | `evidence/phase0-*-audit.json` |
| `python scripts/scan-secrets.py` | Pattern scan of reachable history; exact reviewed TESTONLY fixture exception | `evidence/phase0-secret-scan.json` |
| Solana LiteSVM / deployed binary | NOT RUN: no binary, Windows runtime unsupported | Source `backend/test/onchain.test.ts` |
| NEAR unit/sandbox/WASM/Testnet | NOT RUN at baseline | No NEAR code inherited |

No lint script exists in either package. Unit tests include mocks and do not prove on-chain behavior. README test counts are outdated; these counts come from this run.

## Audit findings

- Preserve `README.md` and its CSaCLAB team attribution as inherited Solana documentation until the NEAR flow exists. Existing live links are Solana claims, not independently verified NEAR proofs.
- No tracked LICENSE file found. Public source access does not itself establish a license; owner must confirm permission/attribution before public submission.
- `backend/src/chain/index.ts`: unknown CHAIN values silently become MockChain. Phase 3 must fail closed for unsupported network values.
- `backend/src/chain/solana.ts`, private `send`: `tx?.meta?.err ?? null` treats absent transaction evidence as success. Never reuse this in NEAR receipt handling.
- `backend/src/auth.ts`: no REDLINE_API_KEY means identity checks stand down, regardless of CHAIN. Public deployment must explicitly require identity.
- LiteSVM test wrapper returns normally when runtime/binary unavailable, producing a misleading pass count. Not counted as verified chain tests here.
- Current u64 amounts, raw Ed25519 Solana-address auth, synchronous boolean adapter outcomes and Anchor logs cannot represent NEAR accounts/u128 amounts/asynchronous receipts. Additive migration required.
- Custom secret scan checks six credential patterns and suspicious filenames across all reachable Git blobs; it is not an entropy scanner or proof of absence. The explicit `gsk_TESTONLY...` fixture in `backend/test/fixes.test.ts:113` was reviewed and allowlisted by exact blob/path/rule. No credential values are included in scan reports.
- No dependency upgrades, database start, deployment, wallet transaction, original-repo mutation or history rewrite performed in this phase.
