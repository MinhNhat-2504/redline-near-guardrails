# REDLINE — two-minute demo recording

Prepared2026-11-12. Use the actual application and existing verified Testnet receipts. No new funding, grants, key resets or payments are needed for this video. Do not pretend an archived transaction is being executed live.

## Before recording

Start the frontend using the README. Backend and Gemini are optional for the historical tour. Close unrelated tabs and notifications; keep private files, terminal secrets, wallet backup and sessions out of frame. Use a readable browser zoom and test the microphone. The English tour is available under Bằng chứng → English. This is a bilingual evidence tour, not full-workspace localization.

## Shot list and narration

| Time | Screen / action | English voice-over or subtitle |
| --- | --- | --- |
| 0–15s | Overview, purpose and two entry choices | “An AI assistant should not need unrestricted access to your wallet. REDLINE lets you approve a budget, recipient and expiry, while a NEAR contract checks each payment request.” |
| 15–30s | Open evidence demo; select English; show policy budget | “This is a historical Testnet walkthrough with independently verified transaction evidence. The owner granted 0.05 NEAR, at most three payments, to one recipient.” |
| 30–50s | Within permission; open the exact Explorer receipt | “A valid 0.01 NEAR payment settled. This link opens its actual transaction. The contract's private callback, not the UI prediction, finalizes the payment.” |
| 50–75s | Over budget, then wrong recipient | “A request beyond the budget is blocked. A request to another recipient is blocked too. These denials do not transfer principal to the proposed recipient; execution fees can still apply.” |
| 75–90s | Permission revoked | “The owner can revoke future spending. A subsequent request is rejected even with budget remaining. Revocation does not cancel a transfer already dispatched.” |
| 90–110s | English implementation disclosure; briefly show README/contract proof links | “NEAR FunctionCall keys scope the executor to one vault method. The contract reserves funds before dispatch and settles accounting through callbacks. The repo includes receipt evidence and separate local sandbox concurrency tests.” |
| 110–125s | Back to overview or evidence page | “This prototype uses controlled payment requests. Optional Gemini explanations cannot sign or bypass the policy. You can reproduce the project from the public repo and inspect the evidence without connecting a wallet.” |

Optional: replace the architecture shot with the owner's existing withdrawal receipt and say “The owner can withdraw available principal back to their own wallet.” Use the archived `AwCQh5ceQyom6WM46TkmaDdJG2AFBFQwvvcu8KrWcMHp` link; do not sign another withdrawal solely for recording.

## Accurate labels

- On screen: “Historical NEAR Testnet evidence”; label offline demos clearly.
- Never call controlled JSON cases a live LLM attack or an autonomous purchasing workflow.
- A failed Gemini call is optional-provider unavailability, not a failed on-chain policy. Do not stage a fake AI answer.
- The demo's read-only tour has no financial side effects; the live operational workspace does use real Testnet transactions with separate review.
- Do not claim Mainnet, USDC, marketplace, cross-chain settlement, professional audit or mobile acceptance that has not been verified.

Watch the exported video before posting. Ensure text and at least one complete receipt URL are readable, audio is audible, and personal/private data is absent. Attach the video to the human-published X demo post; the local-only project needs a video under organizer Q-012.
