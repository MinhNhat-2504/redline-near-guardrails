> **REDLINE for NEAR — Testnet prototype, migration in progress.** This repository preserves the original [REDLINE](https://github.com/MinhNhat-2504/REDLINE) Git history and CSaCLAB credits. The Solana documentation below is inherited. The [NEAR Safety Vault](contracts/near-safety-vault) passes21 SDK unit tests and real sandbox receipt tests ([reproduce](contracts/near-safety-vault/tests/README.md)). CLI/API proofs and the owner-operated `/near` browser financial walkthrough are verified: nine browser financial transactions cover storage/principal, grant creation,0.01NEAR ALLOW, cap/recipient/nonce rejection, revoke and post-revoke rejection. Browser operation was observed by the owner; transaction receipts were independently checked through public RPC. Automated real-wallet browser E2E and the README-only newcomer acceptance remain unverified. [Phase5 review](docs/PHASE5_SECURITY_REVIEW.md) records passing regressions and the remaining high Zod advisory; this is not an audited mainnet product. Existing Solana demo/explorer links below do not prove NEAR functionality.

## NEAR Testnet entry point

Use [NEAR browser setup and walkthrough](docs/NEAR_BROWSER_DEMO.md) and [backend setup](docs/NEAR_BACKEND_SETUP.md), not the inherited Solana quick start below. The NEAR UI is `http://localhost:5173/near`; API health is `http://127.0.0.1:8787/health`. Keep both local servers open. `/` retains the original dashboard/Policy Lab; those tools are not connected to NEAR grants.

- **Review without signing:** [browser proof matrix](docs/NEAR_BROWSER_DEMO.md#verified-browser-financial-walkthrough--2026-11-04), [raw Testnet proof](docs/TESTNET_PROOF.md), [security demo scope](docs/NEAR_SECURITY_DEMO.md).
- **Run local checks:** root `npm ci` then `npm run check`; backend `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Initial backend build generates Prisma; do not regenerate its Windows DLL while an existing backend process is using it. Isolated Postgres and local NEAR sandbox reproduction are in the [Phase5 review](docs/PHASE5_SECURITY_REVIEW.md).
- **Run a fresh signed demo:** requires a Testnet wallet and a separately scoped executor credential installed by its owner, local Postgres, and explicit storage/principal/grant signatures. No owner key goes in the backend. Existing demo grants are revoked; historical proof review needs no new payment, key reset or signature. The runbook documents fixed demo amounts and durable retry behavior; no unattended one-click setup is claimed.

See [verified progress](docs/PROGRESS.md), [test evidence](docs/TEST_RESULTS.md), [reuse attribution](docs/REUSED_COMPONENTS.md) and [threat model](docs/NEAR_THREAT_MODEL.md). Phase4 and Phase5 remain PARTIAL; UI/UX redesign is deferred.

<div align="center">

# 🛡️ REDLINE

### ⚡ Autonomous finance. Hard limits.

**The programmable safety layer for autonomous DeFi agents on Solana.**
The agent proposes · **the chain decides** · nobody can talk it out of the answer.

[![Backend CI](https://img.shields.io/github/actions/workflow/status/NguyenPhong2912/REDLINE/backend-ci.yml?branch=main&label=CI&style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/NguyenPhong2912/REDLINE/actions/workflows/backend-ci.yml)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://explorer.solana.com/address/Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-Rust-14F195?style=for-the-badge&logo=rust&logoColor=white)](programs/redline_guardrails)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=white)](src)

**🔗 [Live Demo](https://redline-dashboard-28t9.onrender.com)** &nbsp;•&nbsp;
**⛓️ [Program on Devnet](https://explorer.solana.com/address/Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4?cluster=devnet)** &nbsp;•&nbsp;
**🚫 [A Rejected Agent Transfer](https://explorer.solana.com/tx/t4Xb9MFdFBrw8ndHGc496a6fGbGHmNbB2apvPwYzxt36M2LqLxE9k11zhpoSPV1TChw9iKq4AuoofBx1aAwu9su?cluster=devnet)**

<br>

| [📘 README](README.md) | [🔐 Security](docs/SECURITY.md) | [🛠️ Hướng dẫn cài đặt & sử dụng](docs/USER_GUIDE.md) | [🏗️ Architecture](docs/TECHNICAL_ARCHITECTURE.md) |
|:---:|:---:|:---:|:---:|

</div>

<br>

## 📌 Table of Contents

- [💡 What Is REDLINE](#-what-is-redline)
- [😬 The Problem](#-the-problem)
- [🌍 Real-World Scenarios](#-real-world-scenarios)
- [✨ Features](#-features)
- [⚙️ How It Works](#️-how-it-works)
- [🚦 The Seven Gates](#-the-seven-gates)
- [✅ What Is Real Today](#-what-is-real-today)
- [🧰 Tech Stack](#-tech-stack)
- [🗂️ Repository Layout](#️-repository-layout)
- [🚀 Quick Start](#-quick-start)
- [🧪 Quality Checks](#-quality-checks)
- [🎬 Demo In Four Minutes](#-demo-in-four-minutes)
- [👥 Team](#-team)

<br>

## 💡 What Is REDLINE

An owner writes a narrow policy — *which assets, to which addresses, how much, how often, for how long* — and signs it **once**. From that moment a Solana program enforces it on **every single transfer** the agent attempts.

The agent can be a script, an LLM planner, or a compromised process. It makes no difference: it can only ever **propose**. The program checks the proposal against the signed policy and either moves the funds or fails the transaction with a named error — and when it fails, **nothing moves at all**.

> 🔑 **The core idea:** stop trusting the agent to behave, and start relying on a limit it is mathematically incapable of crossing.

<br>

## 😬 The Problem

Automating DeFi today forces an unpleasant choice:

<table>
<tr>
<td width="50%" valign="top">

### 🖐️ Approve everything by hand
Safe, but it doesn't scale. A treasury paying five contributors every week burns days of multisig coordination on payments that are entirely predictable.

</td>
<td width="50%" valign="top">

### 🤖 Give the bot the keys
Fast, but the blast radius is the whole treasury. One bug, one prompt injection, one compromised server — and it's gone in a single transaction.

</td>
</tr>
</table>

And afterwards, there's a third problem nobody solves: dashboards show you **what an agent did**. Almost none can prove **what it was allowed to do** in the first place.

| ⚠️ Risk | 💥 Without REDLINE | 🛡️ With REDLINE |
|---|---|---|
| Buggy agent miscalculates an amount | Treasury drained in one transfer | `SPEND_CAP_EXCEEDED` — transaction fails, nothing moves |
| Phishing swaps a payee address | Funds sent to the attacker | `DESTINATION_NOT_ALLOWED` — address was never in the signed allowlist |
| Agent server is compromised | Attacker has full wallet authority | Damage is capped at the spend limit, on the allowlisted addresses only |
| Prompt injection rewrites the plan | Model reasons its way into a transfer | The model never signs; the on-chain policy is unchanged and unreachable |
| Auditor asks "who authorised this?" | A server log you have to be trusted on | A signed policy digest and a transaction signature anyone can verify |

<br>

## 🌍 Real-World Scenarios

<details open>
<summary><strong>💸 DAO payroll — pay contributors without a multisig round every time</strong></summary>

<br>

A DAO pays five contributors weekly. Today every payment waits 1–2 days for signatures, even though the recipients and the amounts barely change.

With REDLINE the treasury lead signs **one** grant per week: *USDC only · max 8,000 · max 10 transactions · 1h cooldown · these 4 addresses · expires in 7 days.* The payroll bot then runs unattended, and the interesting part is what happens when something goes wrong:

- Accounting typo turns 2,500 into 25,000 → `SPEND_CAP_EXCEEDED`, nothing sent
- A phishing email changes a vendor address in the bot's config → `DESTINATION_NOT_ALLOWED`
- The grant simply expires on Sunday — authority never lingers by default

</details>

<details>
<summary><strong>📊 Automated rebalancing — bounded execution for a lean fund</strong></summary>

<br>

A small fund wants an agent to move capital between strategies without waking anyone at 3am. The risk is not the strategy, it's the authority the strategy runs with.

The grant bounds the agent to a single asset, a per-session budget, a transaction count, and a cooldown that makes runaway loops impossible. If the agent misbehaves the loss is a number the owner chose in advance — not "everything".

</details>

<details>
<summary><strong>🧾 Proving compliance — evidence instead of assurances</strong></summary>

<br>

An auditor asks what a bot was permitted to do last quarter. Instead of exporting server logs and asking to be believed, the treasury points at the chain: the policy digest signed by the owner's wallet, and every ALLOW/REJECT decision the program emitted, each with a transaction signature that anyone can verify independently on Solana Explorer.

</details>

<details>
<summary><strong>🛍️ Renting an agent you did not write</strong></summary>

<br>

A developer publishes an agent version; its `agentHash` pins model, code and config so the build cannot be swapped silently. A treasury rents it for a fixed term, paying the publisher in SOL.

Crucially, renting a stranger's agent does not mean trusting it: it still runs inside a grant the renter signed, so the worst it can do is bounded before it executes a single instruction.

</details>

<br>

## ✨ Features

### Astral interface & Policy Lab

Giao diện 3D mới lấy cảm hứng từ cách trình bày thế giới của HoYoverse: nền xanh đêm, ánh vàng, lõi tinh thể và điều hướng responsive. **Policy Lab** cho phép thử chuỗi đề xuất qua bảy điều kiện, xem lý do chặn và tải báo cáo JSON mà không cần ví hay giao dịch thật.

- [Hướng dẫn Policy Lab và API](docs/POLICY_LAB.md)
- [Mô tả thiết kế Astral](docs/ASTRAL_DESIGN.md)
- Preview riêng không cần Postgres: `cd backend && npm run dev:lab` (cổng 8788), rồi chạy frontend với `VITE_API_URL=http://127.0.0.1:8788`. Các chức năng live cần backend đầy đủ.

<table>
<tr>
<td width="33%" valign="top">

### 🧭 Policy Builder
A four-step wizard for asset scope, spend and transaction caps, cooldown and expiry — with an **AI risk copilot** that explains the risk in plain language.

Its advice sits on top of a deterministic floor it **cannot lower**: a `BLOCK` verdict disables signing, and the model never holds a key.

</td>
<td width="33%" valign="top">

### ⛓️ On-Chain Enforcement
Seven gates checked by the Anchor program **inside the same transaction** that moves the funds.

A rejection is a real failed transaction with a named error code — evidence on-chain, not a log line on a server you have to trust.

</td>
<td width="33%" valign="top">

### 🔓 Non-Custodial Vault
Funds sit in a program-owned PDA. The backend never holds the owner's key and cannot sign on their behalf.

Owners **revoke** or **withdraw** at any time, straight from the wallet.

</td>
</tr>
<tr>
<td valign="top">

### 📜 Verifiable Audit Trail
Every intent, decision and signature is appended, never edited.

An indexer reads the **program's own events**, so the dashboard's numbers come from the chain rather than from the server that produced them.

</td>
<td valign="top">

### 🤖 Agent Runtime
Scripted or LLM-planned. An LLM proposal is clamped to the allowlists and then judged by the program like any other intent.

The planner gets no special privileges for being clever.

</td>
<td valign="top">

### 🛍️ Agent Marketplace
Publish an immutable agent version, claim your listing, set a 24h rate.

Renting is a real SOL payment that the backend **re-reads from Devnet** — checking signer, payee and amount — before the agreement is recorded.

</td>
</tr>
</table>

<br>

## ⚙️ How It Works

```text
owner wallet ──signs create_grant──► Vault PDA + Grant PDA (Solana program)
                                            ▲
agent runtime ──execute_transfer(nonce, amount)──┤  🚦 7 gates → CPI transfer, or a named error and nothing moves
                                            │
indexer ◄── PolicyDecision events ──────────┘  → 📜 append-only audit trail → 📊 live dashboard feed
```

| | Step | What happens |
|:---:|---|---|
| 🧭 | **Design the policy** | The AI copilot explains the risk; a deterministic rule floor it cannot lower returns `ALLOW` / `REVIEW` / `BLOCK`. |
| ✍️ | **One signature** | The wallet signs `create_grant`. Funds move into a program-owned vault; the backend never holds the owner's key. |
| 🚧 | **Bounded execution** | The runtime sends `execute_transfer`. The program runs all seven gates, then transfers via CPI and updates its counters — atomically, in one transaction. |
| 🧾 | **Evidence** | Every proposal, decision and signature is appended to the audit trail; the indexer reads the program's own events. |
| 🔓 | **Owner control** | Revoke or withdraw at any moment, from the wallet. |

<br>

## 🚦 The Seven Gates

Checked in this exact order, on-chain, before a single token moves:

| # | Gate | Rejects when |
|:---:|---|---|
| 1️⃣ | `REVOKED` | The owner has already revoked the grant |
| 2️⃣ | `EXPIRED` | The grant is past its expiry |
| 3️⃣ | `NONCE_REPLAY` | An intent is replayed |
| 4️⃣ | `MINT_NOT_ALLOWED` | The asset is not in the signed allowlist |
| 5️⃣ | `DESTINATION_NOT_ALLOWED` | The recipient is not in the signed allowlist |
| 6️⃣ | `TX_CAP_EXCEEDED` / `SPEND_CAP_EXCEEDED` | The transfer would exceed the transaction or spend budget |
| 7️⃣ | `COOLDOWN_ACTIVE` | The agent is acting sooner than the cooldown permits |

> 🧯 Fail any one of them and the transaction fails as a whole. Balances before and after are **identical** — you can check them yourself on Explorer.

<br>

## ✅ What Is Real Today

| Component | Status |
|---|:---:|
| 🦀 Program `redline_guardrails` (vault PDA, gated `execute_transfer`, revoke, withdraw, events, error codes) | 🟢 **Deployed on Devnet** |
| 👛 Wallet-signed vault / grant / revoke / withdraw from the browser | 🟢 **Live** |
| 🤖 Agent runtime, policy engine, indexer, audit trail, SSE feed | 🟢 **Live on Render + Postgres** |
| 🛍️ Marketplace — publish, claim, rent for real SOL with on-chain payment verification | 🟢 **Live** |
| 🔏 Wallet sign-in — publishing, renting, reviewing, granting, revoking and funding require a signed session; the shared key alone is not identity | 🟢 **Live** |
| 🧾 Scoped reads — your grants, rentals, runs and vault are yours; the audit trail and live feed are redacted server-side for anyone else | 🟢 **Live** |
| ⭐ Agent reputation — reliability from rented on-chain runs (cannot be voted on) + reviews gated one-per-rental | 🟢 **Live** |
| 📊 Analytics computed from the audit trail (volume, allow/block, decision latency) | 🟢 **Live** |
| 🧪 On-chain gate tests against the deployed binary (LiteSVM) | 🟢 **CI on every push** |
| 💹 P&L, APY, win-rate, uptime panels | ⚪ **Removed — nothing in the system measures them, so they are not shown** |

> ⚠️ **Devnet only.** No professional security audit has been performed, and no returns are promised.

<br>

## 🧰 Tech Stack

| Layer | Built with |
|---|---|
| ⛓️ **On-chain** | Rust · Anchor 0.32 · Solana Devnet · SPL Token CPI |
| 🧠 **Backend** | Node 22 · Fastify 5 · Prisma + PostgreSQL · `@solana/kit` · Zod · OpenAI (risk copilot) · SSE |
| 💻 **Frontend** | React 19 · Vite 6 · Tailwind 4 · Radix UI · Recharts · Wallet Standard · one semantic theme in `src/app/theme.ts` |
| 🧪 **Testing** | Vitest · **LiteSVM** running the *real deployed binary* · GitHub Actions on every push |
| ☁️ **Hosting** | Render — static site (dashboard) · web service + Postgres (API), one `render.yaml` blueprint |

The backend speaks Anchor's wire format **by hand** — discriminators, Borsh arguments, the `Grant` account layout, error codes and events are all encoded in `src/chain/anchor.ts` and pinned by tests, with no generated client in the loop.

<br>

## 🗂️ Repository Layout

```text
programs/redline_guardrails   🦀 Anchor program (Rust) — the only thing that can move funds
backend/                      🧠 API, policy engine, agent runtime, indexer, tests — see backend/README.md
src/                          💻 React dashboard (Vite, @solana/kit, Wallet Standard)
docs/                         📚 product, business, architecture, security, user guide
risk-vectors.json             🔒 shared contract both risk-floor implementations must match
render.yaml                   ☁️ Render blueprint — Postgres, API and dashboard in one file
```

<br>

## 🚀 Quick Start

> Requires **Node.js 20+**.

```bash
npm install
cp .env.example .env        # VITE_API_URL etc. — see backend/README.md for the values
npm run dev                 # http://localhost:5173
```

Point `VITE_API_URL` at the hosted backend, or run one locally (`cd backend && npm run dev`). With `CHAIN=mock` the whole flow runs without a wallet or an RPC endpoint.

<br>

## 🧪 Quality Checks

<details>
<summary><strong>💻 Dashboard (29 tests)</strong></summary>

```bash
npm run typecheck && npm test && npm run build
```

</details>

<details>
<summary><strong>🧠 Backend (83 tests)</strong></summary>

```bash
cd backend && npm run typecheck && npm test
```

</details>

<details>
<summary><strong>⛓️ LiteSVM gate tests — against the real deployed binary (Linux/macOS)</strong></summary>

```bash
cd backend && npm run program:fetch && npm run test:onchain
```

</details>

<br>

## 🎬 Demo In Four Minutes

| # | Step |
|:---:|---|
| 1️⃣ | 👛 Connect a Devnet wallet and **Sign in** (the header button — a connected wallet is an address, a signed one is an identity). Guardrails → wizard → risk assessment → **Sign & create on-chain grant** (cap 500 USDC, 5 tx, **1-minute cooldown**). |
| 2️⃣ | ▶️ **Run safe sequence**. The wallet asks you to sign in first — starting a run spends from the vault, so the API wants proof you hold the owner's key rather than the shared key that ships in the page. The runtime performs three paced transfers, each at 20% of the cap. |
| 3️⃣ | ✅ Use **Send safely** for a single owner-triggered transfer. The UI calls `/intents/preview`, pins the returned nonce, and submits only an allowed proposal. Use Policy Lab to inspect over-cap, wrong-recipient, replay, expiry, and revocation scenarios without a fee or failed transaction. |
| 4️⃣ | 🔒 **Revoke** from the wallet; the next attempt fails with `Revoked`. Treasury → **Withdraw**. |

📖 Step-by-step walkthrough: [docs/USER_GUIDE.md](docs/USER_GUIDE.md) · Design: [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) · Threat model: [docs/SECURITY.md](docs/SECURITY.md)

<br>

## 👥 Team

<div align="center">

**CSaCLAB**
Trần An Kỳ · Nguyễn Thành Phong · Nguyễn Hà Thu · Trần Hoàng Thông · Trịnh Ngọc Minh Nhật

🏆 **Tracks:** Best Technical Build · Best Product & Business
🎯 **Theme:** AI × Web3 · DeFi & Digital Assets

---

⚠️ *Devnet only. No returns are promised, and no professional security audit has been performed.*

</div>
