> Historical Solana submission draft, preserved for source attribution only. It is NOT the new NEAR submission or its team. The NEAR project is an independent submission by Trinh Ngoc Minh Nhat. Use the root README and docs/NEAR_PUBLICATION_REVIEW.md for current scope.

# Hackathon submission

## Project name

REDLINE

## Team

CSaCLAB — Trần An Kỳ (representative), Nguyễn Thành Phong, Nguyễn Hà Thu, Trần Hoàng Thông, Trịnh Ngọc Minh Nhật.

## Links

- Live demo (Devnet, hosted backend): https://redline-dashboard-28t9.onrender.com
- Repository: https://github.com/NguyenPhong2912/REDLINE
- Program: `Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4` — https://explorer.solana.com/address/Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4?cluster=devnet
- The same agent, the same grant, the same destination — one allowed, one refused:
  - Allowed, 100 USDC moved: https://explorer.solana.com/tx/5gjTwZeHxddXzeVXEscu9p1tJzNmhYuGZc9dj4EjYt16ZycNCaBjpGazi3uSqVfeLvCftoNjv4kDKteWZLJxRS9h?cluster=devnet
  - Refused for exceeding the spend cap, balances unchanged: https://explorer.solana.com/tx/t4Xb9MFdFBrw8ndHGc496a6fGbGHmNbB2apvPwYzxt36M2LqLxE9k11zhpoSPV1TChw9iKq4AuoofBx1aAwu9su?cluster=devnet

## One sentence

REDLINE is the programmable safety layer that lets AI agents move capital on Solana without ever being able to cross owner-defined limits — enforced by an on-chain program, not by the agent's good behaviour.

## Problem

DeFi automation forces a bad choice: approve every transaction by hand, or hand a bot broad wallet authority and hope. Teams that do delegate cannot prove afterwards what an agent was allowed to do, and a compromised server or a prompt-injected model can drain a treasury in one transaction.

## What REDLINE does

1. The owner defines a narrow policy: asset allowlist, destination allowlist, spend cap, transaction cap, cooldown, expiry.
2. An AI risk copilot reviews it (a deterministic rule floor it cannot lower).
3. The owner signs one `create_grant` transaction. Funds sit in a program-owned vault.
4. The agent runs on a server and proposes transfers. The only path that moves funds is `execute_transfer`, which passes seven on-chain checks before an SPL Token CPI. A rejected intent is a failed transaction with a named error code and zero token movement.
5. Every proposal, decision and signature lands in an append-only audit trail streamed live to the dashboard; an indexer reads the program's own events so the numbers come from the chain, not the server.
6. The owner can revoke or withdraw at any time with their wallet.

## Target user

DAO treasury operators, small crypto funds and agent builders who want automated monitoring and routine execution without giving an AI agent unrestricted custody — and who need evidence for the decisions it made.

## Competition tracks

**Both.**

- Best Technical Build — custom Anchor program with vault PDA, gated CPI transfers, events and error codes; off-chain policy engine mirroring the on-chain gates; agent runtime (scripted + LLM); log indexer; hand-encoded Anchor wire format with pinned tests; on-chain gate tests against the deployed binary in LiteSVM; hosted backend with Postgres; wallet-signed non-custodial flow end to end.
- Best Product & Business — clear beachhead (treasury teams already using automation), subscription + marketplace fee model, and a demo that shows the moment of value: an agent tries to overspend and the chain says no.

## Product theme / use case

AI × Web3 · DeFi & Digital Assets.

## Current progress

Working on Devnet with real transactions: wallet-signed vault and grant creation, agent runtime executing bounded transfers, owner revoke and withdraw, and a live audit feed. The dashboard now previews owner-triggered transfers and submits only valid proposals; rejection cases run in Policy Lab without fees, while the repository retains an earlier Devnet rejection proof for the program's gate enforcement. Backend, Postgres and dashboard are deployed on Render against the public Devnet endpoint. Marketplace rentals settle in real SOL and the payment is verified against the chain — signer, payee and amount — before an agreement is recorded; analytics are computed from the audit trail. P&L, APY, win-rate and uptime panels were removed rather than faked: the system holds no price feed, so no honest number could be put there.

## Biggest challenge

Making enforcement real without a local Solana toolchain and without trusting the server: the program had to be built and deployed from Solana Playground, so the backend speaks Anchor's wire format by hand (discriminators, Borsh, account layout, error codes, events) and tests pin that format against the deployed binary. The second challenge is keeping the demo honest under Devnet conditions — public RPC throttling on shared cloud IPs forced retry-with-backoff in the chain adapter, and a rule that a throttled step retries instead of ending an agent run. The hosted demo still speaks to the public Devnet endpoint, so throttling is absorbed rather than avoided.

## What is next

- DEX adapters (Jupiter/Orca) with instruction inspection so agents can trade, not just transfer.
- Retiring the shared API key entirely: wallet sign-in now backs ownership checks, but routes with no owner to check still fall back to the key. Then organisation accounts and approval workflows.
- Design-partner pilots with three treasury teams on Devnet, then a security review before any mainnet claim.

## Suggested pitch opening

“AI agents need freedom to operate, but they should never have unlimited access to your money. REDLINE gives every agent an explicit boundary — what it can touch, how much, how often, until when — and a Solana program enforces it on every transfer. Here is an agent trying to overspend, and here is the chain refusing.”
