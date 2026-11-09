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

2026-11-04 update: the table above records initial migration provenance. NEAR-native auth/indexer/adapter/vault and browser funding/receipt flows have since been implemented (see PROGRESS). New `src/near/PolicyLab.tsx` and `backend/src/near/policy-lab.ts` provide NEAR snapshot analysis and deterministic copilot explanations; original Solana PolicyLab/LLM routes remain preserved. No Solana USDC simulation is used to authorize NEAR transfers. Details: NEAR_POLICY_LAB.md.

2026-11-05 owner-authorized NEAR redesign directly reuses the four original REDLINE webp illustrations, navy/gold palette, typography/shield and navigation/card concepts from ProtocolExperience/App/Overview. New src/near/Workspace.tsx, Review.tsx and ProofGallery.tsx use the existing NEAR authority/state flow; original Solana UI and providers remain separate. See NEAR_WORKSPACE_REDESIGN.md.


2026-11-10 submission README: initial status table above is historical. Root README now describes current NEAR behavior; original baseline README is preserved as README_SOLANA.md without erasing history/credits. New NEAR vault, backend, UI, Policy Lab and optional Gemini adapter are separated from legacy marketplace/USDC/Anchor claims. Owner confirmed redistribution/licensing permission in chat; exact license selection/public visibility are tracked in NEAR_PUBLICATION_REVIEW.md.
