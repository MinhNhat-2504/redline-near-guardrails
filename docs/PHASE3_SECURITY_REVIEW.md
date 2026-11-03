# Phase 3 activation design - approved by owner

Date: 2026-11-03. Owner approved this architecture in chat after reviewing the proposal. Implementation and verification are in progress; approval does not itself activate credentials or complete Phase 3. The user explicitly requires approval for security-critical decisions. Read-only components and tests are implemented; `CHAIN=near` deliberately refuses to start the inherited writable API until the missing NEAR boundaries are implemented and verified.

## Verified audit findings

- `chain/adapter.ts` uses Solana PDA names, numeric nonce/second timestamps and a binary success result. The runtime immediately writes settled decisions/counters. This cannot represent NEAR PENDING/FAILED/REJECTED faithfully without additive result/state changes.
- `auth.ts` assumes a Solana address decodes directly to the verification public key. Named NEAR account IDs do not encode their access keys. Current auth enforcement also depends on an optional shared API key; neither assumption is acceptable for NEAR owner writes.
- Existing Prisma `BigInt` fields map to signed 64-bit database integers. Even 0.05 NEAR in yocto exceeds that range. NEAR amounts need separate validated decimal storage (proposed `Decimal(39,0)` for u128, `Decimal(20,0)` for u64 nonce/ns) or checked decimal strings. Preserve inherited Solana tables.
- The Solana indexer/Prisma projection is not a NEAR receipt reader. A restart-safe NEAR projection needs atomic event dedupe and checkpoint commits keyed by network/contract/hash/receipt/log index. Current new reader only reconciles explicitly tracked transaction hashes via an injected store; Postgres persistence, continuous block discovery and API wiring are still absent.

## Proposed authentication boundary

1. Separate NEAR auth endpoints/session namespace from inherited Solana auth; no shared-key or unset-key bypass for NEAR owner actions.
2. Wallet signs a NEP-413 off-chain challenge using its FullAccess key **inside the wallet**. Backend never receives that key. Challenge binds configured recipient/application domain, testnet, claimed account, 32-byte random nonce and five-minute expiry. Use the standard domain-separated Borsh/SHA-256 payload; do not reuse plain Solana message verification.
3. Verify signature and query the claimed account's finalized access-key list. The signing public key must currently be a FullAccess key of that account. Account ID supplied by browser alone is not evidence of ownership. Reject unsupported signing schemes until explicitly implemented/tested.
4. Consume challenges atomically once; store hashed session tokens only, with a proposed 30-minute TTL. Recheck the authenticating key is still authorized before NEAR writes. Any RPC failure denies the write. Exact deployment recipient/origin is operator configuration, not request-controlled.
5. Owner wallet directly signs create/deposit/revoke/withdraw. Backend only prepares arguments and verifies resulting on-chain receipts; it cannot act as owner.

NEP-413 explicitly requires FullAccess-key message signing and defines an off-chain message, not a transaction. This does **not** authorize exposing an owner's private key to the app/backend. Source: [official NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md).

## Proposed executor boundary

- Generate a **new dedicated executor FunctionCall key** locally under the separate agent account; do not copy the existing owner/vault/agent FullAccess key into a server configuration.
- Restrict receiver to `nhat-redline-vault.testnet` and method to `execute_transfer`, attached deposit zero, with proposed 0.1 NEAR gas allowance. This allowance limits gas expenditure only; contract grants still enforce recipients, amounts, nonce and spend/tx budgets.
- User reviews/signs the AddKey operation on the agent account. Store the new private credential only in a local ignored secret file or deployment secret store, never in chat/Git/logs. Coding agent will not read existing OS keychain contents. No key has been generated/installed or requested in chat by this proposal.
- Persist the exact intent ID, nonce, args and signed transaction hash before broadcast. Retry/poll the same transaction; never invent a replacement intent on RPC uncertainty. Lost callbacks never trigger an off-chain release of funds.
- Existing demonstration grant is revoked/expired and owner available principal is zero. Any new writable demo requires a separate owner-reviewed funding/grant signature; do not silently reuse it or replenish it.

## Evidence available now

- `src/near/units.ts`: exact integer strings/u128/u64 bounds and nanosecond remainders, no float money.
- `src/near/rpc.ts`: read-only HTTPS JSON-RPC; verifies testnet identity, requests FINAL/finalized views, bounded retries and explicit errors; no signing/broadcast method.
- `src/near/receipts.ts`: identity-bound FINAL receipt parsing, vault-emitter checks, rolled-back event exclusion, matching callback/return/intent fields; runtime errors remain distinct from policy rejection; missing/unknown data never means settlement.
- `src/near/reader.ts`: tracked-hash reconciliation with atomic checkpoint-store contract; restart/dedupe tested with an in-memory test store, not Postgres.
- `chain/index.ts`: unsupported/unimplemented chain config fails closed, including `CHAIN=near`; explicit mock and Solana remain separate.
- `test/near-foundation.test.ts`: integer, public receipt-fixture, synthetic negative, retry, restart/store-failure and startup-config tests. Live read-only verification uses `scripts/near-read-proof.ts`.

Official RPC references consulted: [transaction finality and receipt results](https://docs.near.org/api/rpc/transactions), [finalized account/contract queries](https://docs.near.org/api/rpc/contracts). No new package dependency selected or installed.

## Approval requested before activation

Approve the wallet-only NEP-413 owner-login model and separately scoped executor-key model above, or specify a different custody/authentication requirement. Approval of this architecture is separate from a later user signature to install a new key or create a new grant. Architecture decision APPROVED by owner. Implement and test the approved model; installation of a new executor key and future grant/funding transactions still require user signatures. Phase 3 is PARTIAL, not PASS; UI, Postgres projection and writable end-to-end tests are not implemented.

## Approved implementation checkpoint

The owner approved this model in chat. Implementation now includes NEAR-specific server dispatch, NEP-413 sessions, a scoped-key adapter, atomic intent/event journals, additive numeric-safe Postgres migration and direct-call block discovery. Verified setup and exact limitations: [NEAR_BACKEND_SETUP.md](NEAR_BACKEND_SETUP.md). Local code/tests and read-only live proof pass; actual executor key installation, a new funded owner grant and authenticated public write proof remain user-signature boundaries. Do not request architecture approval again.
