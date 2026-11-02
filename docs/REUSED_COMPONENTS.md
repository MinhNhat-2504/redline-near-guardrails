# Provenance and reuse

Inherited in full from MinhNhat-2504/REDLINE commit `aa0b0b044d9b6e01b71a14791ec68b24385e098b`, retaining ancestor `2fe62d6` and original author/team credits. This code predates the hackathon; importing it does not make it new work.

| Source | Reuse / migration |
| --- | --- |
| `src/` React dashboard, Policy Lab, copilot, recovery UI | Inherited unchanged; later add NEAR wallet and receipt states |
| `backend/src/policy/`, `runtime/` | Inherited advisory logic; NEAR units, pending accounting and schema mapping still needed |
| `backend/src/chain/{adapter,index,mock,solana,anchor}.ts` | Inherited unchanged; retain MockChain; later add NEAR adapter |
| `backend/src/auth.ts`, `indexer.ts`, `routes/` | Solana-specific authentication/indexing; NEAR replacements not implemented |
| `programs/redline_guardrails/`, root Cargo workspace | Original Anchor reference, preserved unchanged |
| `render.yaml`, `.github/workflows/` | Inherited Solana deployment/CI; not evidence of a NEAR deployment |
| `contracts/near-safety-vault/` | New NEAR implementation; 21 SDK unit tests and actual sandbox receipts verified, not public Testnet deployment |
| `docs/{BASELINE,PROGRESS,NEAR_DECISIONS,NEAR_MIGRATION_PLAN,REUSED_COMPONENTS}.md`, `scripts/scan-secrets.py` | New migration evidence and tooling |

No tracked LICENSE file was found. Confirm redistribution rights with the project owner before public submission. Original CSaCLAB credits remain intact in README.
