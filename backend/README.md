# REDLINE backend

Off-chain services for REDLINE: REST API, policy engine, agent runtime, log indexer, audit trail and live feed. The chain is the only authority — everything here either *proposes* an action or *records* what the chain decided.

Hosted instance: `https://redline-api-ku3s.onrender.com` (Render web service + Render Postgres, public Devnet RPC). Provisioned from `render.yaml` at the repo root. Program: `Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4`.

```text
React app ──► API (Fastify) ──► Agent Runtime ──► ChainAdapter ──► Solana program
   ▲              │                                    │
   └── SSE feed ──┴──────────── audit_event ◄──────────┴── Indexer (program logs)
```

## Run locally

Requires Node.js 22+ and a Postgres URL (Render/Neon free tier is fine).

```bash
cd backend
npm install
cp .env.example .env        # set DATABASE_URL; CHAIN=mock needs nothing else
npm run db:push
npm run dev                 # http://localhost:8787
```

Smoke-test the six-beat demo (bash + python on PATH):

```bash
bash scripts/demo.sh
```

Expected: three compliant transfers confirmed, the fourth rejected with `SPEND_CAP_EXCEEDED` and counters unchanged, then `REVOKED` after the owner revokes.

## Chain adapters

| `CHAIN=` | Behaviour |
|---|---|
| `mock` | In-memory program with the same 7 gates and counter updates. Signatures are prefixed `MOCK…`. `MOCK_CLOCK_SPEED=60` makes a 1-minute cooldown pass in 1 second. |
| `solana` | `src/chain/solana.ts` sends real transactions. `execute_transfer` goes out with `skipPreflight` so a rejection lands on-chain as evidence. Retries with backoff on RPC throttling. |

The backend speaks Anchor's wire format without a generated client: `src/chain/anchor.ts` encodes discriminators, Borsh arguments, the `Grant` account layout, error codes and events; `test/anchor.test.ts` pins it. The IDL exported from Solana Playground is in `idl/redline_guardrails.json` for reference.

## Gate order (matches the program)

1 `REVOKED` · 2 `EXPIRED` · 3 `NONCE_REPLAY` · 4 `MINT_NOT_ALLOWED` · 5 `DESTINATION_NOT_ALLOWED` · 6 `TX_CAP_EXCEEDED` / `SPEND_CAP_EXCEEDED` · 7 `COOLDOWN_ACTIVE`

`src/policy/engine.ts` mirrors this order, so a precheck reason code always equals the program error the chain would return (codes 6005–6012).

## API

Identity, in one paragraph. The shared `REDLINE_API_KEY` ships inside the public
frontend bundle, so **anyone can read it** — it keeps drive-by traffic off the
write routes and proves nothing about who is calling. Anything that acts on
someone's property (publishing a build, pricing a listing, renting, reviewing,
granting or revoking authority, starting or stopping a run, topping up a vault)
requires a **wallet session**: the wallet signs a server-issued challenge and the
API checks the signature against the address, which is a raw ed25519 public key.

Reads are scoped the same way. A route that returns one wallet's activity returns
*the caller's*; a stranger gets either an empty set or a redacted projection —
never someone else's wallets, vaults and destinations. See `src/redact.ts` for
what redaction keeps (event type, reason code, amount, on-chain signature — the
evidence) and what it removes (identity and linkage).

A deployment with **no** `REDLINE_API_KEY` has declared itself local or mock:
writes stay open and reads stay unscoped, so `scripts/demo.sh` runs the whole
six-beat demo with no headers.

A session is the real credential: `POST /auth/nonce` returns a challenge naming the wallet and a one-time nonce, the wallet signs those bytes, and `POST /auth/verify` exchanges the signature for a bearer token. A Solana address *is* an ed25519 public key, so the signature verifies against the address itself. Nonces are single-use and expire in 5 minutes; sessions last 12 hours and are stored as a SHA-256 of the token, never the token.

Routes that act on someone's property require a session and accept nothing else:

- `PATCH /listings/:id` — a listing can only be claimed by the wallet that will be paid for it.
- `POST /runs` and `POST /intents` — both make the executor spend from a grant's vault, so both check the caller owns that grant. Without this the shared key alone would let anyone drive someone else's agent up to its cap.

On a deployment with no `REDLINE_API_KEY` these checks stand down: that configuration has already declared itself local or mock, where writes are open and `scripts/demo.sh` runs without a wallet.

`REDLINE_API_KEY` in `x-redline-key` remains as a fallback for the scripted demo and headless callers. It is a drive-by guard, not authentication: it ships to a public frontend and anyone can read it out of the bundle. Owner actions on-chain are authorised by the wallet signature the program verifies, whatever the API thinks.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | chain kind, cluster, program id, executor, build version, indexer state, rate limit, and whether writes require a signature |
| POST | `/auth/nonce` · `/auth/verify` | wallet sign-in: issue a challenge, exchange a signature for a session |
| GET | `/auth/me` | the wallet behind the current session |
| POST | `/agents` | publish an immutable build. **Needs a wallet session** — the publisher is taken from the signature, never from the body. Re-publishing the same bytes from the same wallet is idempotent; a different wallet gets its own row (`agentHash` is unique per publisher) |
| GET | `/agents` · `?mine=true` · `?publisher=` | the catalogue, each row carrying `publisherWallet`, `isMine`, `unclaimed` and its `rating` |
| GET | `/agents/:id` | one build with its listings and reputation |
| POST | `/grants/preflight` | everything `POST /grants` would refuse, answered **before** the wallet signs: rental required (402), wrong wallet (403), unknown agent (404), plus the lifetime clamped to the rental term and the executor to name in `create_grant` |
| POST | `/grants` | record a wallet-signed grant (`grantPda`, `createSignature`, `agentId`, policy). On Solana the account is read back and must name this wallet as owner, this API's executor and the posted policy's hash — a stranger cannot register someone else's grant. An agent someone else published and priced needs a live `hireId` covering it |
| GET | `/grants` | **the caller's** grants with live on-chain state; empty for an anonymous caller |
| GET | `/grants/:id` | full for the owner; redacted for anyone else (`onchain` carries counters and limits only) |
| POST | `/grants/:id/revoke` | record an owner-signed `revoke_grant` (signature required on Solana; refused with 409 while the account still reads active) |
| POST | `/intents/preview` | dry-run the gates; no write, no fee |
| POST | `/intents` | record one intent and submit it only when the current policy precheck allows it; `proveOnChain: true` submits a denied one too, so the program refuses it and the refusal carries a signature |
| GET | `/grants/:id/intents` | intents with decisions and chain transactions; destinations redacted for anyone but the owner |
| POST | `/runs` · `/runs/:id/stop` | start / stop the agent runtime (`mode: scripted | llm`). Runs left `running` by a restart are closed at boot; a run under a rental stops when the rental ends |
| GET | `/grants/:id/feed` | server-sent events (`*` = all grants). Redacted unless the subscriber owns the grant. `EventSource` cannot send headers, so this one route accepts the session token as `?access_token=` |
| GET | `/audit?grant=` | the caller's own trail in full; anonymous callers get a short recent window, redacted, and cannot filter it by grant |
| GET | `/vaults/:owner` | vault PDA, ATA and live balance. Only your own |
| GET | `/listings` · PATCH `/listings/:id` | marketplace listings; the publisher claims one by setting a payout wallet and a 24h rate (write-once wallet) |
| GET | `/grants/:id/swap-policy` · POST | what a grant may trade, and the owner-signed decision to let it trade at all |
| POST | `/swaps/preview` | dry-run the swap gates and report the floor the policy implies for a quote |
| POST | `/swaps` | route a trade; refused locally before it costs a fee, then judged on-chain by what the vault came back with |
| GET | `/protocol/fee` | the take rate and the wallet that collects it, so the dashboard builds a payment the API will accept |
| GET | `/protocol/revenue` | what the fee has collected, per rental, with payment signatures |
| GET | `/listings/:id/reviews` · POST | renter reviews; posting needs a session **and** a rental on that listing, one review per rental |
| GET | `/listings/:id/reviewable` | whether this wallet may review, and which rentals are open |
| GET | `/hires` · POST `/hires` | rental agreements; the SOL payment is fetched from Devnet and checked (signer, payee, rate × 24h periods) before the row is written. A grant for a rented agent records which agreement covers it, and is refused once it lapses |
| GET | `/analytics?owner=` | volume, allowed/blocked counts and decision latency computed from the audit trail |
| GET | `/protocol/overview?owner=` | ordered seven-gate catalog, network state and decision/rejection rollup for the live policy visualization |
| GET | `/policy/presets` | three versioned hypothetical policy configurations for Policy Lab |
| POST | `/policy/simulate` | public, bounded sequential simulation with seven-gate traces; no wallet, database writes or chain calls |
| POST | `/devnet/fund` | mint demo USDC into **your own** vault (Devnet only) |
| POST | `/risk-assess` | AI risk copilot with deterministic floor |
| POST | `/assistant` | answers a question about recorded state; the brief is assembled server-side and is the only fact source the model gets |

Amounts are strings of base units (`"100000000"` = 100 USDC).

Policy Lab input limits, examples, response semantics and Vietnamese user documentation: [docs/POLICY_LAB.md](../docs/POLICY_LAB.md). Run `npm run dev:lab` for an isolated local server on `127.0.0.1:8788` without Postgres or a chain executor. Only the two Policy Lab endpoints are available in this mode; other endpoints explicitly return 503. The normal server includes both new routes automatically, with no schema migration.

`/protocol/overview`, `/analytics` and `/assistant` count a grant as active only while it is neither revoked nor past its window. Each grant carries its own `expiresAt` (mirrored from the program at creation); the `PolicyVersion` row's date is shared by every grant with the same policy shape and is only a fallback for rows written before the column existed.

## Trading inside a policy (DEX adapter)

**Status: the off-chain half ships and is tested; `execute_swap` is written but
not yet deployed.** The deployed program (`Fj7MV8Z2…`) still knows only
`execute_transfer`, so `CHAIN=solana` answers "this deployment's chain adapter
cannot trade" until the upgrade lands. `CHAIN=mock` runs the whole flow today.

### Why it does not parse DEX instructions

Every venue encodes a swap differently, a parser is one upgrade behind the venue
forever, and — the part that actually matters — a route whose instruction looks
perfect can still hand the vault back less than it agreed to accept. Parsing
answers "did this instruction look like the swap we expected?", which is the
wrong question.

So the adapter brackets the call instead. It records the vault's input and
output balances, invokes whatever program the owner allowlisted with whatever
payload the agent supplied, reads the balances again, and judges the trade on
what actually moved:

```
spent_in  = before_in  - after_in    must be <= amount_in   (the route cannot overdraw)
out       = after_out  - before_out  must be >= min_out     (the fill cannot be worse than agreed)
```

Both token accounts are constrained to be the vault's own, which is what makes
"the output returns to the vault" a fact rather than a hope — a route cannot
deliver the proceeds elsewhere and still satisfy the account constraints.

### The gates a trade adds

Gates 1–4 and 6–7 are the transfer gates, unchanged: a trade is still a spend of
the same vault under the same grant, against the same caps, cooldown and expiry.

Gate 5 changes shape. A transfer asks *may the money go to that account?*; a swap
has no recipient, so it asks *may this grant route through that program, and may
it buy that token?* — `PROGRAM_NOT_ALLOWED` and `OUTPUT_MINT_NOT_ALLOWED`. The
second is what stops an agent swapping a treasury into something nobody can sell,
and no transfer gate would ever have caught it.

Gate 8 is new and runs **after** execution, because a swap's outcome is not
knowable in advance: `SLIPPAGE_EXCEEDED`, checked against the balance that
landed. `POLICY_GATES` in `src/routes/protocol.ts` marks each gate's phase for
exactly this reason.

### What slippage protection does and does not buy

The program has no oracle, and the two sides of a pair have different decimals,
so no output floor can be derived from the input amount. What it does instead is
make the agent's quote part of the transaction and require the accepted minimum
to sit within the owner's tolerance of it.

That defends against **the route**: a sandwich, a stale pool, or a venue that
fills worse than it promised all revert, because the quote was fixed before the
swap ran. It does **not** defend against an executor that quotes dishonestly in
the first place — a compromised runtime could quote low and accept low. What
bounds that is the spend cap and the mint allowlist: it can lose at most the cap,
and only into a token the owner named. Slippage is a quality control, not a
custody control, and the code says so where it is enforced.

### Deploying the upgrade

`programs/redline_guardrails/src/lib.rs` adds `create_swap_policy` and
`execute_swap`. The change is deliberately **additive**:

- `Grant` is byte-identical. Trading permission lives in a new `SwapPolicy` PDA
  (`["swap", grant]`), so every grant already signed on Devnet stays decodable
  and keeps working exactly as before.
- Error codes 6014–6020 are appended; no existing code moves. Those numbers are
  already written into audit rows, and renumbering would rewrite what past
  records mean.
- A grant with no `SwapPolicy` cannot trade. Every grant signed before this
  existed is in that state and stays there until its owner says otherwise.

Deploy the same way as v2 (Solana Playground → Build → Upgrade, keeping the
program id), then `npm run program:fetch && npm run test:onchain`.
`test/onchain-swap.test.ts` skips itself while the deployed binary predates
`execute_swap` and starts testing the moment the upgrade lands.

## Marketplace take rate

A rental is one wallet-signed transaction carrying two transfers: the
publisher's share and the protocol fee. The fee comes **out of** the advertised
price rather than on top of it, so the number on the card is what the renter
pays, and "10% of rental revenue" means 10% of what the publisher earns.

`POST /hires` re-derives the split from its own configuration and checks **both**
legs against the chain before writing the rental (`src/protocol-fee.ts`,
`checkPaymentLegs`). Verifying only the publisher leg would let a hand-built
transaction pay the publisher, skip the treasury and still register the rental —
which is how a take rate quietly becomes optional.

Set `PROTOCOL_TREASURY` to collect; leave it empty and the fee is zero and the
payment is the single transfer the marketplace made before. `PROTOCOL_FEE_BPS`
defaults to 1000 (10%) and is capped at 2000.

Each rental records what it actually paid — `paidLamports`, `publisherLamports`,
`protocolFeeLamports`, `protocolFeeBps` — because the rate can change and a
receipt has to keep saying what was charged at the time.

## Reputation

An agent's standing is two numbers, kept apart on purpose (`src/routes/ratings.ts`).

**Reliability** is derived from records nobody can vote on: the policy decisions
its grants produced (`allowed / decisions`) and what the chain did with the
transfers it was allowed to make (`successes / attempts`). An agent whose
proposals were repeatedly refused has a low compliance rate no matter what its
renters say.

**Reviews** come only from wallets that paid for a rental. `AgentReview.hireId`
is unique, so one rental buys exactly one review — inflating a score means
renting again, which costs real SOL.

The headline `score` (0–100) weights reliability 70 / reviews 30, needs at least
three recorded decisions before the reliability half counts, and is `null` with
neither. An agent with no history is **unrated**, which is not the same as badly
rated — `basis` says which halves the score used.

## Runtime modes

- `scripted` — three paced transfers of 20% of the cap, then stop. Rejection cases run in Policy Lab without fees or failed transactions.
- `llm` — a model proposes an action under a strict JSON schema; the proposal is clamped to the allowlists and judged by the program like any other intent. Needs `OPENAI_API_KEY`.

Transaction requests accept canonical 32-byte Solana addresses and positive base-unit amounts up to `u64::MAX`. `/intents/preview` returns the nonce and exact verdict used by the UI; `/intents` rechecks the live state and does not bypass a denied precheck unless the grant owner sets `proveOnChain`, in which case the denied proposal is sent so that Solana — not this server — is what refuses it (paced per grant; disable with `ONCHAIN_PROOF=off`). The program remains the final authority if chain state changes between those calls.

Both the planner and the risk copilot talk to any OpenAI-compatible chat-completions endpoint (`src/llm-client.ts`). Set `OPENAI_BASE_URL` to point at one — Groq's free tier needs no card — or leave it unset for OpenAI, which has no free tier. `OPENAI_MODEL` must name a model that endpoint serves; when it does not, the call fails and the copilot answers from the deterministic floor, with the reason logged.

## Indexer

With `CHAIN=solana` the server subscribes to `logsNotifications` for the program. Every transaction that mentions it — ours or anyone's — is decoded: `PolicyDecision` events update mirrored counters and become `chain.policy_decision` audit rows; failed transactions become `chain.tx_failed` with the mapped reason code.

A subscription only delivers what happens while it is open, so on every connect the indexer first replays anything recorded on-chain after the newest signature already in the audit trail (`getSignaturesForAddress`, capped at 1,000). A restart, a dropped socket or a host spin-down therefore leaves no hole in the record. Writes are idempotent per signature, so the overlap between the replay and the live stream is free.

## Tests

```bash
npm test                 # 83 tests including Policy Lab, API boundaries and expired-grant counts
npm run program:fetch    # download the deployed program binary from Devnet
npm run test:onchain     # LiteSVM: 3 allows, nonce replay, spend cap, foreign destination, wrong signer, revoke
```

`test:onchain` needs Linux/macOS (LiteSVM ships no Windows build) and runs in CI on every push (`.github/workflows/backend-ci.yml`).

## Deploy (Render)

`render.yaml` at the repo root provisions this service, its Postgres database and the dashboard together — Render → Blueprints → New Blueprint Instance, point it at this repo.

It sets root directory `backend`, Node 22 via `.node-version`, `npm run build` then `npm start` (`prisma db push` + server), health check on `/health`, and wires `DATABASE_URL` from the database. Render injects `PORT`; do not set it.

Render prompts once for the secrets the blueprint marks `sync: false`: `SOLANA_RPC_URL` / `SOLANA_WS_URL` (the public Devnet endpoint works; a dedicated RPC avoids the throttling that shared cloud IPs attract), `EXECUTOR_KEYPAIR_PATH` and `DEMO_OWNER_KEYPAIR_PATH` as the JSON byte arrays themselves (Render has no persistent disk for a key file), `DEMO_USDC_MINT`, `DEMO_OWNER_WALLET`, `DEMO_VAULT_PDA`, `DEMO_OPS_DESTINATION`, `OPENAI_API_KEY`. `REDLINE_API_KEY` is generated by Render.

`EXECUTOR_KEYPAIR_PATH` must be set before the first deploy: `CHAIN=solana` makes `initChain` throw without it and the service will not boot.

The dashboard needs nothing entered by hand — every `VITE_*` value is pulled from this service with `fromService`, so the API key, program ID and demo accounts cannot drift between the two.

## Keys and demo accounts

`npm run devnet:setup` creates the executor and destination keypairs, a demo USDC mint, the vault, and funds it. `executor.json` signs `execute_transfer` and pays its fees. `owner.json` exists only for headless demos and as the demo mint authority; in the product the owner signs in the browser. Never commit keypairs or `.env` (they are gitignored).

## Maintenance

- `npm run db:cleanup` removes intents that never reached a decision (also swept at startup).
- `scripts/withdraw-check.ts` proves the `withdraw` account order against the live program.

## NEAR migration checkpoint

Phase 2 public Testnet contract proof is verified in [TESTNET_PROOF](../docs/TESTNET_PROOF.md). Backend NEAR support is **read-only foundation**, not a writable API adapter. `CHAIN=near` currently fails explicitly; unknown CHAIN values no longer silently select mock. Existing mock/Solana paths remain available.

- `src/near/units.ts`: exact string/BigInt NEAR, yocto, u128/u64 and nanosecond conversions.
- `src/near/rpc.ts`: Testnet-verified HTTPS read-only RPC; `src/near/receipts.ts`: FINAL receipt/event/callback interpretation.
- `src/near/reader.ts`: reconciliation of explicitly tracked transaction hashes. Requires a durable atomically deduping store implementation; no continuous historical discovery or Postgres wiring yet.
- `npm test` includes offline receipt-fixture and negative security tests; `npx tsx scripts/near-read-proof.ts` is an explicit **live, read-only** Testnet check. Never treat offline fixtures as fresh on-chain transactions.

Owner auth, scoped executor signing, NEAR-safe database fields, routes and UI are pending. See the reviewable [security activation proposal](../docs/PHASE3_SECURITY_REVIEW.md); no owner keys belong on the backend. Existing generic routes/auth/indexer retain Solana semantics and must not be enabled for NEAR without that work.
