# Approved Zod4 migration results — 2026-11-04

Status: migration PASS; overall Phase4/Phase5 remain PARTIAL. Base commit `5d39f0a`. The owner explicitly approved this shared validator migration in chat, then requested continuation of the interrupted work. No new signature, funding, contract/key permission, database schema or deployment change was required.

## Changes

- Backend Zod3.25.76 → pinned4.6.7; package lock updated with lifecycle scripts disabled. No audit suppression or force upgrade.
- Five record declarations now specify string keys explicitly (funding, receipt arguments/events, reset outcomes and inherited agent config). `viewSchema` uses the supported ZodType generic; strict objects, Ed25519-only auth and immutable receipt/request binding remain enforced.
- Positive financial amount validation catches conversion failures. Grant/ledger arithmetic runs only after decimal fields validate. Invalid values still fail parsing; malformed input now becomes a controlled400 rather than an uncaught BigInt error. No valid amount/nonce maximum was relaxed.
- Offline migration corpus and61 additional regressions cover57 before/after inputs, constrained collection resource behavior, exact integer bounds/strict policy/records and HTTP rejection before execution. Existing nine real saved browser receipts are replayed offline by Phase5 regression tests; no new on-chain event is inferred.

## Verified evidence

| Check | Actual result | docs/evidence |
|---|---|---|
| Capture before3.25.76/after4.6.7, compare corpus | PASS57 identical acceptance/successful outputs; three old native exceptions now controlled rejection | phase5-zod3-compat-before.json; phase5-zod4-compat-after.json; phase5-zod4-helpers-check.log |
| Backend typecheck + npm test + direct tsc build | PASS509 tests/37 files | phase5-zod4-backend-checks.log |
| Real isolated Postgres integration | PASS25 tests, temporary container cleaned up | phase5-zod4-postgres.log |
| Frontend npm run check | PASS221 tests/29 files, typecheck/Vite build | phase5-zod4-frontend-checks.log |
| Standalone strict helper compilation and npm ci dry-run | PASS, lock consistent; dry-run is not a fresh-install claim | phase5-zod4-helpers-check.log; phase5-zod4-lock-check.log |
| Backend npm audit | PASS exit0;0 vulnerabilities reported | phase5-zod4-backend-audit.json |
| Frontend npm audit | FAIL exit1;10low/0moderate/0high/0critical | phase5-zod4-frontend-audit.json |

Bounded collection regression allocates only4096 local strings and asserts a max4 array is rejected before its element transform runs. A two-element array still executes that transform normally. This catches eager per-element work without flaky timing/RSS thresholds or public load testing; it is not a general denial-of-service audit.

The corpus comparison normalizes validation errors and compares rejection decisions plus valid outputs, not byte-identical Zod error text/issue shapes. The three recorded Zod3 native exceptions were `transfer amount=bad`, `grant finalized_spent=bad`, `ledger credited=bad`; final Zod4 capture has no native exceptions. Legacy simulation defaults, Solana address/u64 checks and agent record configuration are covered; an exhaustive equivalence proof is not claimed.

No new contract/sandbox run was needed for this backend-only migration. The preceding Phase5 contract21/real sandbox53tx136receipts run remains the current contract evidence. No Prisma regeneration while the user's backend may hold its DLL, no existing DB mutation, no new browser transaction or wallet/CLI credential access occurred. The initial interrupted patch had a context mismatch, then a shell edit used a duplicated backend path; both stopped/failed without the intended edit and were corrected before verification. Neither is counted as a test PASS.

## Remaining work

The high backend advisory that prompted approval is resolved in the installed dependency audit; this does not certify a vulnerability-free product. Frontend wallet SDK low advisories, hosted CI results, automated wallet/reload/cancellation cases and README-only newcomer acceptance remain open. Phase4 dashboard/PolicyLab integration/network navigation/native wallet balance gaps are tracked in PHASE5_SECURITY_REVIEW.md. UI polish is still deferred. Remote GitHub push authentication remains blocked; local commit does not imply remote synchronization.

References consulted: [official Zod4 migration guide](https://zod.dev/v4/changelog) for two-argument records, unknown-field optionality, defaults and generics; [official API](https://zod.dev/api). The actual installed package/audit and observed test outputs are the version-specific evidence.

- Zod4 pre-commit: Git history/index credential-pattern scan PASS, 1036 blobs/0 findings; inherited exact TESTONLY fixture exception retained. Pattern scope only; user login report excluded. Staged whitespace PASS. Evidence phase5-zod4-secret-scan.json.
