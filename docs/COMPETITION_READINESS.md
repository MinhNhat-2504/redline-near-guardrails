# REDLINE competition readiness

Current review: **2026-11-12**. Target: owner submission on **2026-11-13**. The product has a verified Testnet core and a presentation/release candidate. Final submission is still pending the owner's visual rehearsal, video, public X post and form confirmation. No award probability or independent audit is claimed.

**Use [current release checklist](NEAR_SUBMISSION_READY.md), [recording script](NEAR_DEMO_RECORDING.md) and [submission drafts](NEAR_SUBMISSION_DRAFT.md).** Public main, scoped license and hosted CI have since been verified; the older blockers below are historical and superseded. Local release checks: frontend443/backend649 tests and typechecks/builds PASS; current provider reliability/mobile acceptance remain limited. New English covers the read-only guided tour, not full-workspace translation.

## Historical 2026-11-03 review (retained for traceability)

The remaining sections describe the Nov3 checkpoint, not the current release status. Old instructions to fund/sign another grant are obsolete; no new payment is needed for the current historical-evidence video.

## Verified organizer guidance

- [Official site](https://nearhackathon.com/): Track06 emphasizes spending limits, policy engines and constrained wallets. Screening checks reproducibility/README feature claims; humans decide winners. The site cites earlier judging themes as preparation guidance, not a published weighted scoring rubric for this event.
- [Official HACKATHON.md](https://nearhackathon.com/HACKATHON.md), fetched today: Q002 permits inherited cross-chain products but evaluates new NEAR work in the hackathon window; Q003 asks for separated history/diff; Q012 requires video when a local-only demo cannot be opened by judges; Q014 asks for a LICENSE; Q017 describes screening. Public repo + public human-published demo post required. No publication/submission authorized by this document.

## Engineering bar and next priorities

| Priority | Outcome to demonstrate | Verified status / remaining gap |
|---|---|---|
| P0 | Real backend-scoped transfer ALLOW, private callback SETTLED, conserved owner ledger and payee delta | PASS: scoped API0.01NEAR FINAL/SETTLED GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ; independently verified callbacks, key,80Tgas, payee10.05→10.06, available0.1→0.09/pending0. Backend EXPIRED rejection also verified. |
| P0 | Honest, predictable authorization and lifecycle | Contract/sandbox pending/replay/callback protections and real scoped key/auth verified. Expiry guard/explicit1..8h selector and real normal API payment verified; browser lifecycle still needs owner E2E. |
| P1 | Browser walkthrough a judge can complete | Phase4 PARTIAL: `/near` implements wallet login, reviewed policy, expiry/ledger, intent scenarios, journal/receipt links.183 frontend tests/build passed; browser wallet interoperability/first-time onboarding NOT RUN. |
| P1 | Visible attack resistance | Contract Testnet cap/recipient/revoke proofs + real sandbox races/failure tests exist. Backend public proof currently EXPIRED only. Present exactly which layer/scenario was verified; never label hand-written intents as a live LLM attack. |
| P1 | A real agent-use story | Show how untrusted agent intents meet on-chain constraints. Distinguish scripted scenarios from actual LLM integration, and implemented behavior from planned agent/marketplace features. |
| P1 | Fresh-clone reproducibility and accurate claims | Document versions, isolated tests, real proofs and legacy/new diff. Hosted CI result not verified. Git remote push currently blocked on owner authentication; no tracked LICENSE found, owner choice pending. |
| P2 | Concise evidence-led submission | Target2-minute video: normal payment, malicious intent blocked, unchanged denied balance, expiry/revoke controls and receipts. Human publishes demo; repo visibility/license/submission require owner approval. |

The distinctive security story should make NEAR async behavior visible: reservation before Promise prevents cap overspend; only verified callback finalizes accounting; retries keep packet identity; key scope isolates the owner's signing key. Revocation blocks new intents and does not promise to cancel a transfer already dispatched. These claims must link their existing local/public proof scopes accurately.

## One hour versus eight hours

Use8h for the current hands-on rehearsal; retain1h as the conservative NEW-proposal default and let the owner explicitly choose1..8h. Shorter expiry reduces the delegation window; longer expiry improves operational tolerance. Spend cap0.05/max3/one payee remain constant. A polished product exposes remaining time and handles expiry clearly, rather than requiring repeated terminal repair. Do not extend authority merely to keep a public demo available: a read-only evidence view can display historical finalized results after grants expire.

## Current unsigned proposal

Local public policy review PASS: grant-fed48ec7b5db4ba59fe224d9f807d64f, validity8h, deadline2026-11-04 03:46:11.164 UTC+7, cap0.05/max3/payee-only. Canonical SHA256 matches policy_hash138919a19b9a15eaa1edff9ff8123d1c883d06636b5229d80252edda62062c24 and owner/network/contract/grant binding. phase3-eight-hour-proposal-review.json is UNSIGNED validation only; no owner signature or transfer proof established. Immediate next step: owner reviews/signs generated create_grant, then independent FINAL verification before0.01 transfer.
