# REDLINE for NEAR

Updated: 2026-11-03 (Asia/Saigon).

- Goal: migrate REDLINE's bounded agent transfers to a real NEAR Testnet vault for the AI Security & Defense track. No NEAR deployment or transaction proof exists yet.
- Inputs: fully read `NEAR_REDLINE_MIGRATION_PLAN_AGENT.md` and `NEAR_Hackathon_2026_REDLINE_Complete_Playbook.pdf` (19 pages). The Markdown's history-preserving import takes precedence over the PDF's selective-copy suggestion.
- Provenance: full Git history cloned from `https://github.com/MinhNhat-2504/REDLINE`, baseline `aa0b0b044d9b6e01b71a14791ec68b24385e098b`; previous `2fe62d6`. Original team credits remain in README. No license file found in tracked source; ownership/licensing must be resolved before submission.
- Remotes: `origin` is MinhNhat-2504/redline-near-guardrails; `upstream` is MinhNhat-2504/REDLINE. Development branch `feat/near-mvp`. Never push upstream or rewrite history.
- Inherited stack: React 19/Vite 6/TypeScript frontend; Node/Fastify 5/Prisma 6/Postgres backend; Anchor Rust Solana program. Chain adapter only supports mock and Solana. Wallet auth, schemas, USDC units and indexer are Solana-specific.
- Baseline verified on Windows, Node 24.14.1/npm 11.11.0: frontend 163 tests, backend 284 tests, both typechecks/builds pass. Logs in `docs/evidence/`. Vitest/esbuild require execution outside sandbox due to spawn EPERM.
- Open risks: inherited dependency advisories (frontend 6, backend 7); auth disabled when REDLINE_API_KEY unset; Solana adapter treats missing RPC transaction as success; LiteSVM wrappers can report passing tests without executing when runtime/binary absent. These must not become NEAR semantics.
- NEAR design requirements: owner-isolated ledger; pending amount and tx slot reservation before Promise; private idempotent callbacks; no timeout unlock; withdraw only available funds; native NEAR u128/string JSON; owner funds storage separately; advisory backend cannot override contract.
- Environment: Windows has no Rust in PATH. Ubuntu WSL exists and has C compiler/curl; project-local Rust setup is in progress under ignored `.tooling/`.
- Next: finish Phase 0 provenance/push; implement isolated NEAR crate, unit and real sandbox tests; stop at Testnet credentials/signature boundary. See `docs/PROGRESS.md` for current evidence.
