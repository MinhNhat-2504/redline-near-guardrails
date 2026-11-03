# NEAR vault threat model (implementation review in progress)

Scope: native NEAR Testnet prototype. Contract/public CLI proofs and scoped backend NEP-413/API ALLOW/EXPIRED proofs are verified; browser wallet E2E remains PARTIAL. No independent audit, token transfers, swaps, marketplace payments or mainnet functionality is claimed.

| Threat | Implementation control | Required evidence |
| --- | --- | --- |
| Executor impersonation through signer forwarding | Match predecessor to immutable executor | Unit spoofing test and sandbox failed receipt |
| Another owner spends/revokes/withdraws funds | Owner identity derived from direct signed caller; ledger by AccountId; revoke checks stored owner | Two-owner tests |
| Concurrent cap bypass | Reserve amount/slot before Promise; all cap checks include pending | Unit interleaving + sandbox concurrent requests |
| Replay on retry | Intent ID tombstone; consumed nonce never restored | Pending/settled/failed replay tests |
| Spoofed/double callback | Private export + explicit self-predecessor; exactly one promise result; transition only PENDING | Sandbox auth rejection; SDK result tests |
| Transfer failure | Callback releases reservation once, leaves nonce consumed | Missing long-form recipient receipt failure + balances |
| Revoke during pending | Stop new intents, settle queued ones | Unit interleaving and sandbox revoke |
| Withdraw races pending transfer | Separate pending withdrawals and outgoing amount reservation | Unit/sandbox balance invariants |
| Storage drains principal or locks another owner | Separate allowances; owner pays grants/withdrawals, executor pays its intents (including denials); actual storage growth charge, bounded IDs/allowlist | Insufficient allowance rollback and owner storage unchanged on denials |
| Callback runs out of storage | Fixed-size persisted callback transitions, no new records | Storage usage and real callbacks |
| Insufficient callback gas/liquidity | Minimum remaining call gas; callback fixed allocation; physical storage/operating buffer check | Low gas/liquid reserve tests |
| Lost callback / RPC timeout | Leave reservation locked; observe on-chain state, no timeout unlock | Pending view and documented limitation |
| Fraudulent proof | Distinguish policy REJECTED in successful receipt from runtime panic; attach real outcomes only | Sandbox transcript; later Testnet explorer links |
| Spoofed wallet identity | NEP-413 one-use challenge, exact recipient/callback/client mode, finalized FullAccess ownership and recheck; memory-only browser bearer | Backend unit/real-DB tests, actual CLI authentication and owner-observed browser sign-in; financial browser E2E pending |
| Storage failure loses browser request identity | Persist/read back public intent before enabling submission; malformed saved JSON retained, validated before restore; compare saved request on submit | Frontend storage failure/corruption tests; no credentials persisted |
| Wrong or optimistic journal row unlocks another request | Exact grant/intent/hash/state plus FINAL matching event/amount/recipient/nonce before completing saved intent | Browser boundary unit tests plus parsing a real saved callback; not browser E2E |
| Browser cached empty account skips wallet connection | Validate actual account ID, not array length; identity-only signIn omits contractId, creates no browser FunctionCall key | Reproduced MyNearWallet10.1.4 empty sentinel from SDK source; regression unit tests; real popup retry pending |
| Unsupported wallet or lost callback silently weakens authentication | Removed MyNearWallet after actual connection-deprecation popup; rejected evaluated Meteor wrapper that drops callbackUrl; current Intear10.1.4 forwards exact callback and Testnet network without requested contract authority | Actual installed-adapter synthetic DOM test; no CLI-mode fallback; Intear sign-in owner-observed, financial E2E pending |
| Funding twice after ambiguous wallet response | Persist public funding attempt before signature; block new signatures, retain hash and reconcile exact FINAL sender/receiver/method/amount/args/gas and execution height after baseline; no automatic wallet re-sign | Saved real CLI funding receipt verifier tests, malformed/optimistic/old-hash tests; new web funding NOT RUN |
| Treating an RPC failure as an empty owner vault | Only explicit finalized registration GuestPanic maps to unregistered with block metadata; no fabricated ledger; all other errors unavailable | Actual public web-owner registration snapshot and escaped-panic/unknown-error/rate-limit tests |

Open limitations: global grant IDs can be squatted (use random IDs); executor must fund/register its own non-refundable storage allowance; direct owner calls only; no repair for stuck callbacks; immutable on-chain record retention grows storage; a contract account FullAccess key/deployment upgrade can replace all controls. Backend projection/auth/reconciliation are implemented with limited finalized direct-call discovery, not full archival discovery. Browser wallet interoperability, new public replay demonstration, CI hosted results and production deployment hardening remain unverified. Browser localStorage is not an atomic cross-tab lock; the durable backend request binding/executor lock and on-chain nonce/reservations remain authoritative. Same-origin XSS can compromise a browser session; no production XSS-hardening audit is claimed.

Intear's wallet connection uses a local generated app-auth key (not owner FullAccess/executor credentials) and a logout bridge. The backend's own NEP-413 signature/ownership checks remain mandatory; SDK account/postMessage data alone never authenticates the owner or proves financial settlement. Third-party wallet transport/cancellation and its browser-stored app session are not independently audited. Importing an existing CLI account or creating/funding a new wallet owner requires explicit owner coordination.

Owner deposits have no contract-level idempotency identifier. The browser funding journal is a conservative single-tab guard, not distributed exactly-once execution: manual unknown/cancelled-without-hash recovery and simultaneous tabs remain limitations. Signatures/funding require owner review; current UI only offers the initial fixed demo amounts, not automatic replenishment. Known successful receipts may complete that exact attempt; a changed method, owner, amount, old block or unrelated hash must not unlock it.

Do not use the inherited Solana `tx?.meta?.err ?? null` success fallback or the inherited no-API-key auth bypass for NEAR. Neither is a valid trust boundary.
