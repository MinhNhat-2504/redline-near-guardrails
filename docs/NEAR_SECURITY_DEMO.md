# Evidence-first security demo

Status: PARTIAL; do not present a browser case as on-chain proof until its FINAL receipts and stored intent have been checked. The new UI prepares controlled JSON and requires explicit submission.

Superseding checkpoint2026-11-04: all nine owner-operated browser financial receipts, including public nonce replay and post-revoke denial, are now independently verified in the [browser evidence matrix](NEAR_BROWSER_DEMO.md#verified-browser-financial-walkthrough--2026-11-04). The historical remaining-work column below is retained as earlier scope, not current NOT RUN status. Automated real-wallet E2E and the newcomer guided acceptance are still unverified. [Phase5 security review](PHASE5_SECURITY_REVIEW.md) records the fresh SDK/sandbox/DB/HTTP regression run and open dependency findings.

| Demonstration | Existing verified evidence | Remaining work |
| --- | --- | --- |
| Native ALLOW + callback | Phase2 CLI0.05NEAR SETTLED; new scoped API0.01NEAR FINAL/SETTLED `GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ`, payee10.05→10.06, available0.1→0.09 | Browser signing/transfer still pending |
| Over spend cap | Phase2 CLI `J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x`, SPEND_CAP_EXCEEDED | New browser case not run |
| Wrong recipient | Phase2 CLI `8MCrqH1rQXTPvfuG6Yk9TuAVXgGo7mj55rmfMvNL9DuB`, DESTINATION_NOT_ALLOWED | New browser case not run |
| Revoke and denial | Phase2 revoke `C2tYedjVQycHtCovMXTGr75DLWbmRNawLjkwnSxobCEU`; denial `4huc1hEC2EF3jEft21Ga7xBvoFMCuvzsCTsiLWJkGBU4` | New browser case not run |
| Expiry via scoped API | `Gqv1YhjYHr9ZVkLnEscPmHFSAWDZ5TcgHhCUxvPPmxGQ`, FINAL REJECTED/EXPIRED; unchanged principal/payee | Available now in saved RPC evidence |
| Replay | Contract sandbox protection and backend durable retry tests | New public/browser replay proof not run |
| Concurrent cap / failed Promise / callback spoof | Real sandbox suite; local regression evidence | Not claimed as new public Testnet cases |

## Present the mechanism

Owner authorizes an immutable policy. An untrusted agent proposes an intent. The contract reserves both amount and transaction slot before dispatch. A private callback settles or releases exactly once. A timeout alone never releases reservations. Retry keeps the same durable intent/packet; nonce protects a different replay attempt.

Suggested live order: snapshot → ALLOW0.01 → SETTLED callback/ledger/payee evidence → same-ID retry (no second payment) → new-ID nonce0 replay → over-cap → wrong recipient → explicit owner revoke → post-revoke denial. Rejected calls cost gas/storage but must not reduce principal or payee balance. Do not automatically create another grant, deposit or reset key if a case fails.

## Scoped API ALLOW acceptance gate

Capture public BEFORE ledger/payee/grant/key snapshots, the exact reviewed request and canonical policy. After the owner submits, capture `tx` with `wait_until=FINAL`, all receipt outcomes, stored intent, grant, owner ledger, payee and scoped-key views. Require:

1. Exact vault receiver, executor signer, approved scoped public key, method execute_transfer,80Tgas, zero attached deposit, reviewed0.01 amount/payee/policy/nonce/intent.
2. Successful transfer receipt for payee and successful private vault callback; matching intent_completed event and stored intent SETTLED/OK. A transaction hash or API200 alone is insufficient.
3. Grant finalized spend +0.01, count+1, nonce+1, pending0; owner finalized spend+0.01 and available−0.01, pending0; payee amount+0.01, no additional payee transactions within the compared interval. Use receipt amounts as the primary payment evidence when unrelated account activity makes balance deltas ambiguous.
4. Same intent retry cannot pay again; retained history matches the same packet/hash. Independently verify the public data and archive it before marking PASS.

This gate passed for transaction `GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ`: public BEFORE/AFTER snapshots, production receipt verifier and separate exact client-response matching are saved in `phase3-api-allow-*`. Browser signing and a public replay demonstration remain separate pending gates. The demo uses scripted JSON attacks; no LLM-generated attack or guarantee of preventing every prompt injection is claimed.

Public collection helper (does not sign, submit or read a session): `backend/scripts/capture-near-allow-proof.ts`. From backend, `npx.cmd tsx scripts/capture-near-allow-proof.ts --help` lists `before <public-request.json> <new-output.json>`, `after <public-request.json> <new-output.json> <public-tx-hash>`, and `verify <before.json> <after.json>`. Existing output files are never overwritten. Capture BEFORE after request preparation but before explicit --submit. `verify` checks the production receipt parser, exact arguments/key/gas, callback/stored intent, grant/ledger/payee deltas, scoped permission and snapshot heights after the latest receipt. Separately compare the returned hash with the actual public API response to establish the API linkage. Synthetic verifier tests never create public evidence or prove an actual transfer.
