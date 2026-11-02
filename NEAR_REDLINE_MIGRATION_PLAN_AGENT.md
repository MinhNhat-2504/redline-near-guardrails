# REDLINE for NEAR — Migration & Execution Plan (Agent Handoff)

> **Tài liệu thực thi dành cho AI coding agent trong VS Code**  
> Ngày lập: **03/11/2026** · Múi giờ: **Asia/Ho_Chi_Minh (UTC+7)**  
> Repo gốc: <https://github.com/MinhNhat-2504/REDLINE>  
> Repo mới: <https://github.com/MinhNhat-2504/redline-near-guardrails>  
> Track chính: **AI Security & Defense** · Track phụ (chỉ khi có bằng chứng): **Agent Economy**  
> Deadline nộp: **06:59 ngày 15/11/2026 (giờ Việt Nam)** (14/11 23:59 UTC). Nên nộp trước ngày 14/11.

**Định nghĩa hoàn thành:** sản phẩm REDLINE chạy trên **NEAR Testnet** với policy do người dùng ký, vault, agent executor, các giới hạn thực thi **on-chain**, 1 chuyển tiền thành công và nhiều trường hợp từ chối có bằng chứng kiểm chứng; README và demo trung thực, build/test chạy được. **Không** xem “thay tên Solana thành NEAR” hoặc chạy mock thành hoàn thành.

## 0. Cách AI agent phải làm việc

1. **Đọc toàn bộ file này trước khi code**, rồi đọc README, kiến trúc, threat model, chain adapter, policy engine, Rust program, test hiện tại. Kiểm tra trạng thái repo mới và quyền truy cập; nếu chưa có code, thực hiện Phase 0 dưới đây. Không suy đoán source từ tên dự án.
2. **Triển khai từng Phase nhỏ**: audit -> contract -> chain adapter -> UI -> proof -> tài liệu. Khi xong mỗi phase, tự chạy lint/typecheck/test/build, báo kết quả và commit. Nếu không có môi trường/chứng thực triển khai, nêu giới hạn, không tự nhận đã deploy hoặc đã test.
3. Không rewrite toàn bộ code, không xóa Solana code cho tới khi NEAR flow chạy được. **Không sửa/force push repo REDLINE gốc**. Không ghi/commit private key, mnemonic, `.env`, dữ liệu tài khoản thật; chỉ Testnet.
4. Ghi **lịch sử nguồn gốc**: source cũ có trước hackathon, phần mới được xây kể từ cuộc thi; giữ copyright/attribution/team credits. Repo mới không làm code cũ thành code mới được tính. Repo phải **Public trước khi nộp**.
5. Tra cứu **NEAR documentation và near-sdk bản thực tế** trước khi chọn API và lock version. Nếu hướng dẫn này khác runtime/API mới nhất, ghi thay đổi và lý do trong `docs/NEAR_DECISIONS.md`.
6. Không gửi tiền mainnet, không tự thực hiện giao dịch có giá trị thật, không nộp bài hay tạo PR trên repo gốc nếu chưa được ủy quyền.

## 1. Hiện trạng đã xác minh (03/11/2026)

| Mảng | REDLINE Solana (đang có) | Mục tiêu NEAR |
|---|---|---|
| Repo | `MinhNhat-2504/REDLINE`, public, nhánh `main` | `MinhNhat-2504/redline-near-guardrails`, mới tạo, private, tại thời điểm kiểm tra **chưa có source** |
| Smart contract | `programs/redline_guardrails/src/lib.rs` (Rust/Anchor, Solana Devnet); vault PDA, grant PDA, `execute_transfer`, revoke, withdraw | Contract Rust **near-sdk** + vault ledger, grants, callbacks; deploy NEAR Testnet |
| Backend | `backend/` — Fastify, Prisma/Postgres, SSE, auth, agent runtime | Giữ, bổ sung NEAR adapter, NEAR event reader và integration tests |
| Policy engine | `backend/src/policy/engine.ts`, 7 gates, risk copilot | Giữ semantics, chuẩn hóa NEAR fields; kết quả cuối **do contract quyết định** |
| Chain abstraction | `backend/src/chain/adapter.ts`, `mock.ts`, `solana.ts`, `index.ts` | Thêm `near.ts`, không làm hỏng `MockChain` |
| Frontend | `src/` — React/Vite dashboard, Policy Lab, wallet và vault controls | Giữ UI, thêm NEAR wallet, network states và explorer link |
| Marketplace | Mua/thuê agent, thanh toán SOL, xác minh on-chain Devnet | Không ưu tiên trong MVP; chỉ đổi sang NEAR khi phần bảo vệ an toàn đã chạy |
| Swap | `execute_swap` có code/test, tài liệu ghi **chưa deploy** trên Solana Devnet | Hoãn sang sau MVP; không quảng cáo swap là live |

**Sự thật về code gốc:** repo có các commit ngày 24/09/2026 và 27/10/2026; phải minh bạch phần code kế thừa. README mô tả demo live trên Solana Devnet, nhưng **chưa chứng minh** bất kỳ triển khai NEAR nào. Một số hạn chế đã được README/threat model thừa nhận: chưa audit bảo mật chuyên nghiệp; RPC public rate limits; API key chia sẻ trong frontend không phải auth; giao dịch swap live chưa triển khai.

### Đọc trước khi sửa file

```
README.md
REDLINE_AI_KNOWLEDGE_BASE.md
docs/TECHNICAL_ARCHITECTURE.md
docs/SECURITY.md
docs/USER_GUIDE.md
backend/README.md
backend/src/chain/{adapter,index,mock,solana,anchor}.ts
backend/src/policy/{engine,canonical,types}.ts
backend/src/runtime/{executor,runner,llm,scripted}.ts
backend/src/{auth,indexer,env}.ts
backend/src/routes/{grants,intents,vaults,runs,agents}.ts
programs/redline_guardrails/src/lib.rs
backend/test/{engine,onchain,auth,runner-proof}.test.ts
src/app/components/{SolanaWalletControl,GrantSignButton,VaultPanel,PolicyLab}.tsx
render.yaml
```

Dùng lệnh `git ls-files` để tìm file thực tế; nếu path thay đổi, cập nhật plan theo source, không tự tạo placeholder gây hiểu nhầm.

## 2. Phase 0 — Đưa source vào repo mới một cách an toàn

**Điều kiện:** target repo chưa có commit quan trọng. Nếu đã có README/commit riêng, kiểm tra và hợp nhất lịch sử một cách có chủ ý, **không `--force`**.

Mở PowerShell trong thư mục cha (không phải bên trong một repo khác):

```powershell
git clone https://github.com/MinhNhat-2504/REDLINE.git redline-near-guardrails
cd redline-near-guardrails
git remote rename origin upstream
git remote add origin https://github.com/MinhNhat-2504/redline-near-guardrails.git
git remote -v
git status --short
git log --oneline -5
git push -u origin main
```

`origin` phải là **repo mới**, `upstream` là REDLINE gốc. Trước khi public, chạy secret scan và rà soát `.env`, wallet keys, các endpoint/secrets trong code, Git history và license/attributions. Giữ nguyên lịch sử commit, sau đó tạo **branch `feat/near-mvp`** để phát triển; PR/review trước khi merge `main` nếu có thể.

**Gate 0:** UI/backend cũ cài và build được ở baseline, log lệnh/đầu ra; repo NEAR chứa code + lịch sử và không chứa secrets. Tạo `docs/BASELINE.md` ghi sự thật (các test chưa chạy/failed phải ghi rõ).

## 3. Kiến trúc đích và ranh giới tin cậy

```text
Owner NEAR Wallet -- ký tạo grant / nạp / thu hồi / rút --> NEAR Safety Vault (near-sdk)
                                                              ^
AI Agent (không giữ owner key) -- ý định / nonce -------------|  kiểm tra on-chain
                                                              |
React Dashboard <-- API + SSE <-- NEAR Adapter + Event Reader <- receipt/event + tx hash
                            |
                     Policy Lab / AI Risk Copilot
                      (tư vấn, KHÔNG có quyền override)
```

- **Owner wallet:** chỉ owner có quyền tạo/revoke grant, quản lý nạp/rút thuộc quyền sở hữu của mình.
- **Executor agent:** chỉ được gọi phương thức có phạm vi; xác thực `predecessor_account_id`/quyền thực tế và grant gắn với executor; không được quản lý vault hoặc thay chính sách.
- **NEAR Contract:** nguồn sự thật cho tài sản, trạng thái pending, budgets/allowlists, quyết định. Backend/Postgres chỉ mirror/index.
- **AI:** không sở hữu khoá của chủ ví, không quyết định chuyển tiền, không giảm giới hạn cứng.
- **NEAR account abstraction:** Function Call Key có thể giới hạn phương thức và gas allowance, nhưng **không thay thế** việc kiểm tra tham số (recipient/amount) trong contract.

### Rủi ro NEAR phải giải quyết trước khi viết contract

**NEAR cross-contract calls và chuyển tiền có Promise/callback bất đồng bộ.** Không được sao chép giả định **CPI + atomic rollback** từ Solana. Sau khi request gửi đi, contract có thể xử lý lời gọi khác trước khi callback trở lại. Cần reservation accounting và idempotency.

**Mô hình trạng thái đề xuất cho mỗi `intent_id` (unique per grant):**

```text
REJECTED (policy deny, no transfer queued)
APPROVED -> PENDING (reserve amount + tx slot BEFORE Promise)
PENDING -> SETTLED  (callback verified success; finalize spending)
PENDING -> FAILED   (callback verified failure; release reservation)
```

- Duy trì `balance_credit`, `finalized_spent`, `pending_reserved`, `withdraw_pending`, và phần dự trữ storage/gas phù hợp. `available = credited - finalized_spent - pending_reserved - completed_withdrawals - pending_withdrawals` (đây là **bất biến ledger**, không đồng nghĩa số dư vật lý của contract). **Không** cho phép chồng giao dịch vượt `spend_cap` hoặc `max_transactions` bằng cách gửi song song.
- Thiết lập nonce/intent ID chống replay **ngay khi reserve**; request trùng không được sinh Promise thứ hai, kể cả khi callback đang chờ hoặc RPC retry.
- Callback **chỉ contract tự gọi** (`#[private]` hoặc kiểm tra predecessor là contract), liên kết đúng `intent_id`/grant, xác thực kết quả Promise; callback gọi lặp không được ghi tăng/giảm hai lần.
- Khi `REVOKED`, chặn intent mới, nhưng **không tuyên bố** có thể hủy Promise đang pending. Owner chỉ rút phần available không còn reserved; giải thích rõ ràng trong UI.
- Hạn mức và `max_transactions`: tính cả phần **pending** khi kiểm tra; chỉ ghi **finalized spent/tx count** sau callback thành công. Cooldown có thể tính từ lúc reserve để tránh chạy đồng thời; ghi rõ semantics trong contract, UI, tests.
- Trạng thái `PENDING` kéo dài không thể được “unlock” bằng timeout tuỳ ý nếu chưa xác minh kết quả chain. Tạo cách quan sát/reconciliation có kiểm soát; nếu chưa implement được an toàn, block rút và đánh dấu cần xử lý.
- `withdraw` cũng phải chống race với pending transfers, bảo vệ storage balance và được tracking/settled khi cần. Thử trên Testnet, không dùng quỹ thật.
- Mỗi đơn vị NEAR dùng **yoctoNEAR integer** (`u128`/string JSON), không tính tiền bằng float JS. Timestamp NEAR có thể là nanoseconds; chuyển đổi có kiểm tra.
- Không claim rằng callback/emit event chắc chắn persist nếu transaction thất bại. Làm rõ khác nhau giữa `REJECT` được contract ghi log trong receipt thành công và một **failed transaction** với lỗi runtime; không được dàn dựng tx hash.

### 7 Gates và mapping từ Solana sang NEAR

| # | Gate cũ | Gate NEAR native (MVP) | Test phủ định bắt buộc |
|---|---|---|---|
| 1 | REVOKED | `REVOKED` | revoke xong, từ chối intent mới |
| 2 | EXPIRED | `EXPIRED` | intent quá thời gian |
| 3 | NONCE_REPLAY | `NONCE_REPLAY` / duplicate ID | replay khi pending hoặc settled |
| 4 | MINT_NOT_ALLOWED | `ASSET_NOT_ALLOWED` (MVP chỉ NEAR) | asset khác phải bị từ chối; không tuyên bố token khác được hỗ trợ |
| 5 | DESTINATION_NOT_ALLOWED | `DESTINATION_NOT_ALLOWED` | tài khoản nhận ngoài allowlist |
| 6 | TX/SPEND_CAP_EXCEEDED | giới hạn tx/spend gồm **pending** | hai transfers đồng thời không vượt cap |
| 7 | COOLDOWN_ACTIVE | cooldown rõ ràng với pending và finalized | lặp quá nhanh bị từ chối |

**Ngoài 7 gates:** kiểm tra caller/owner/executor, `amount > 0`, active policy hash, số dư owner available, đủ gas/storage của contract, integer overflow, tài khoản nhận hợp lệ. Không tạo false impression rằng 7 gates đã bao phủ mọi vấn đề.

## 4. Phạm vi API đề xuất (thiết kế, agent xác minh lại bằng near-sdk thực tế)

**Contract Rust mới:** `contracts/near-safety-vault/` (đặt tách biệt `programs/redline_guardrails/` để dễ so sánh). Có thể giữ tên `redline-safety-vault` trong metadata. 

| Method (đề xuất) | Quyền | Ý nghĩa và điều kiện |
|---|---|---|
| `deposit` | account owner, payable | nhận native NEAR, ghi credit đúng chủ; lưu ý phí storage |
| `create_grant` | owner | cấu hình executor, policy hash, spend/tx caps, allowlist, expiry/cooldown; validate toàn bộ input |
| `execute_transfer` | executor được cấp quyền | evaluate, persist `REJECTED` hoặc reserve `PENDING`, phát lệnh NEAR transfer Promise |
| `on_transfer_complete` | private callback | xác minh outcome; settle/release đúng một lần |
| `revoke_grant` | owner | chặn ý định mới; pending không tự hủy |
| `withdraw` | owner | rút balance available, không ảnh hưởng phần reserved |
| `get_grant`, `get_intent`, `get_owner_balance` | view | trả về trạng thái on-chain; không dựa vào database làm nguồn sự thật |

**Security review:** phải làm rõ ownership của deposit vs grant, multi-owner isolation, funding cho storage, tài khoản contract được phép đủ số dư trước Promise, và khả năng gas cho callbacks. Với withdraw/transfer, dùng mô hình Promise/callback và ledger được thiết kế/kiểm chứng bằng integration tests. Không tự động deploy mainnet.

## 5. Kế hoạch thực thi theo Phase và tiêu chí nghiệm thu

### Phase 0 — Baseline & code provenance (03/11)

- Clone/import source giữ history như mục 2, `git status` sạch, chạy baseline tests nếu môi trường cho phép.
- Tạo `docs/BASELINE.md`, `docs/NEAR_DECISIONS.md`, `docs/REUSED_COMPONENTS.md` với mapping code cũ/mới.
- Chạy secret scan và ghi tồn đọng security. Không phá code đang chạy.
- **Pass:** repo mới push được, source/build baseline có log thật, phần kế thừa minh bạch.

### Phase 1 — NEAR Rust contract + unit/sandbox tests (04–06/11)

- Tạo contract `contracts/near-safety-vault` theo near-sdk ổn định; thiết kế owner balances, grants, pending intents và event schema.
- Implement nạp/grant, 7 gate, executor authorization, revoke, withdraw, Promise/callback native NEAR.
- Test: happy path, từng gate, signer spoofing, owner/executor mismatch, replay/pending duplicate, cap race, callback failure, withdraw pending, overflow, cooldown/expiry, low balance, storage/gas reserve.
- **Pass:** build WASM, toàn bộ unit + sandbox/integration tests đã triển khai chạy được; không có khả năng bypass policy trong các test phủ định.

### Phase 2 — NEAR Testnet proof (07/11)

- Deploy NEAR Testnet với **tài khoản test riêng**, funding test và quyền truy cập được bảo vệ. Ghi address, contract version/wasm hash, explorer links và ngày deploy.
- Run: owner deposit -> create grant -> agent transfer hợp lệ -> reject vượt cap/recipient -> revoke -> verify balances/counters bằng chain query.
- Không viết tx hash giả. Phân biệt transaction initiated, receipt status và callback settled.
- **Pass:** có **ít nhất một NEAR Testnet tx thành công**, một policy deny ghi nhận trên Testnet và chứng cứ dữ liệu chain; README dẫn đến bằng chứng thật.

### Phase 3 — Backend `NearChain` adapter & event reader (08–09/11)

- Audit `backend/src/chain/adapter.ts`; bổ sung `near.ts`, config `CHAIN=near` và default Testnet rõ ràng. **Không sửa breaking** `MockChain`.
- Convert near wallet auth theo chuẩn chữ ký/account NEAR; không bê cách xác minh Solana address Ed25519 sang nguyên si.
- Implement intent serialization/yocto conversion, error mapping, real tx+receipt status, retry/backoff idempotent; key server chỉ làm executor scope.
- Thay indexer Solana bằng NEAR receipt/event reader có resume/reconciliation; `Postgres` chỉ cache/project chain events. Có watermark/dedupe và phân biệt pending/finalized/rejected.
- **Pass:** `CHAIN=near` chạy end-to-end, typecheck/tests pass, không route nhầm Solana, không giả số liệu.

### Phase 4 — NEAR Wallet + frontend + demo (10–11/11)

- Thêm NEAR wallet onboarding/sign-in và một network switch rõ ràng; không tái sử dụng nhãn Solana/Devnet Explorer cho giao dịch NEAR.
- Giữ React dashboard, risk copilot và Policy Lab. Hiển thị `PENDING` / `SETTLED` / `FAILED` / `REJECTED`, NEAR Explorer links, actual owner wallet balances.
- Thiết kế **one-click guided demo** (trên Testnet) với ví test/demo: sign policy -> safe transfer -> cap/allowlist deny -> revoke -> audit trail. Không đòi người dùng ký mainnet.
- **Pass:** người mới theo README có thể đi hết demo mà không cần hiểu hệ thống Solana; UI labels và receipts chính xác.

### Phase 5 — Security hardening & quality gate (12/11)

- Review threat model mới: async receipts, callback spoofing, pending stuck, access keys, backend auth, multi-owner, storage/gas, RPC race, secret handling.
- Run unit/integration/e2e và lệnh build đã thống nhất; bổ sung CI riêng NEAR. Xử lý flaky/rate limit rõ ràng.
- Không tuyên bố đã audit độc lập; chỉ **prototype/Testnet**. Không quảng cáo tính năng swap/NEP-141 marketplace chưa được triển khai.
- **Pass:** no critical known bypass, reproducible test suite và demo tối thiểu.

### Phase 6 — Submission package (13–14/11)

- README tiếng Anh (có thể thêm tiếng Việt): vấn đề, giải pháp, NEAR architecture, **what is new**, what is reused, threat model, limitations, exact setup/tests, Testnet address, transaction proofs, 2-minute demo walkthrough.
- Video 2–4 phút có screen capture + NEAR Explorer proof; bài X công khai, tag `@NEARProtocol` + `#NEARHackathon`, nói rõ tham gia NEAR Hackathon.
- Chuyển repo **Public**, xác minh xem được khi đăng xuất, rà soát secrets/license. Nộp repo link + demo X link trước deadline. Track 06 chính; track 07 **chỉ chọn nếu** functionality agent marketplace/payment trên NEAR có hoạt động.
- **Pass:** một người lạ clone/build/test được theo README; mọi claim chính có chứng cứ; submission form xác nhận thành công.

## 6. Task board chi tiết theo ưu tiên

| ID | Priority | Deliverable | Dependencies | Definition of Done |
|---|---|---|---|---|
| GIT-01 | P0 | Import code giữ history, provenance | none | repo mới hoạt động, upstream đúng |
| BASE-02 | P0 | audit & test baseline | GIT-01 | logs trung thực trong docs |
| SC-01 | P0 | NEAR vault ledger/storage design | BASE-02 | invariants/test model review |
| SC-02 | P0 | grant + 7 gates + permissions | SC-01 | unit tests pass |
| SC-03 | P0 | async transfer, reserve, callback, revoke, withdraw | SC-02 | failure/race tests pass |
| NET-01 | P0 | NEAR Testnet deploy + proof | SC-03 | explorer links verified |
| API-01 | P0 | NearChain adapter + auth | NET-01 | real tx receipts processed |
| API-02 | P0 | event reader + audit | API-01 | restart + dedupe works |
| WEB-01 | P0 | NEAR wallet, transaction states | API-01 | end-to-end UI works |
| QA-01 | P0 | security/E2E/CI | WEB-01 | reproducible tests |
| SUB-01 | P0 | README, video, public repo, X, submit | QA-01 | all URLs accessible |
| ECON-01 | P2 | NEAR-native agent rental/payment + on-chain proof | NET-01 | only if spare time, scope validated |
| FT-01 | P2 | NEP-141 assets / stablecoin | QA-01 | storage, callback, token risks tested |
| SWAP-01 | P3 | cross-chain swap/NEAR Intents | QA-01 | defer, never claim live until proven |

**Cut line nếu chậm:** bỏ ECON-01, FT-01, SWAP-01. Không bỏ SC-03, NET-01, QA-01, SUB-01. Không dành quá nhiều thời gian cosmetic UI trước khi có NEAR tx thật.

## 7. Test matrix bắt buộc (không được “mock pass” thay bằng proof)

| Test ID | Scenario | Expected |
|---|---|---|
| T01 | owner deposit và tạo grant | ledger credit, policy hash/owner/executor đúng |
| T02 | executor hợp lệ chuyển trong hạn mức | PENDING -> SETTLED, balance/counter chính xác |
| T03 | owner/executor giả mạo | reject, không có transfer Promise |
| T04 | nhận ngoài allowlist | `DESTINATION_NOT_ALLOWED`, không trừ tiền |
| T05 | vượt spend cap | reject, kể cả khi có pending reserved |
| T06 | vượt transaction cap | reject, kể cả pending tx slot |
| T07 | replay nonce/intent ID khi PENDING/SETTLED | không chuyển tiền lần hai |
| T08 | expiry, revoke, cooldown | reject ý định mới theo policy |
| T09 | 2 parallel transfers cộng lại vượt cap | tối đa phần hợp lệ được reserve |
| T10 | Promise thất bại | callback giải phóng reservation **một lần** |
| T11 | callback ngoài contract hoặc callback lại | không thể sửa state trái phép |
| T12 | owner withdraw khi transfer pending | chỉ phần available, không bội chi |
| T13 | RPC reconnect / indexer restart | no duplicated events, status reconcile |
| T14 | TypeScript conversion NEAR yocto / timestamp | không làm tròn, không overflow |
| T15 | NEAR Testnet demo thật | tx hash, account và receipt trạng thái khớp UI/README |

Để báo tiến độ, mỗi test cần trạng thái `PASS` / `FAIL` / `NOT RUN`, command, môi trường và đường dẫn bằng chứng. **Không đánh dấu pass chỉ vì code có test hoặc mock chạy thành công.**

## 8. Giao diện đầu ra và cấu trúc file khuyến nghị

```text
redline-near-guardrails/
  README.md                               # update for NEAR hackathon; provenance + demo
  docs/
    BASELINE.md                           # inherited code and baseline test evidence
    NEAR_MIGRATION_PLAN.md                # copy of this file in repo
    NEAR_DECISIONS.md                     # decisions, risk, SDK versions
    REUSED_COMPONENTS.md                  # source-to-NEAR attribution
    NEAR_THREAT_MODEL.md                  # async receipts, storage, auth and economics
    TESTNET_PROOF.md                      # accounts + real tx/receipt explorer links
    DEMO_SCRIPT.md                        # short reproducible presentation
    TEST_RESULTS.md                       # command, PASS/FAIL/NOT RUN
  contracts/near-safety-vault/            # near-sdk Rust, isolated from Solana program
  backend/src/chain/near.ts               # adapter compatible with current interface
  backend/src/near/                     # event reader, receipt status, types (if needed)
  src/app/...                             # reusable React UI + NEAR wallet support
  programs/redline_guardrails/            # original Solana reference (not deployed for NEAR)
```

**Commit naming ví dụ:** `chore: establish inherited REDLINE baseline`, `feat(near-contract): enforce grants with pending ledger`, `test(near): prevent concurrent cap bypass`, `feat(near-adapter): process receipts`, `docs: attach testnet proofs`. Mỗi commit ghi rõ `Changed`, `Verified`, `Known limitations` trong PR/changelog.

## 9. Hướng dẫn AI agent tự tiếp tục an toàn

Agent phải đọc kế hoạch và **tiếp tục tự làm** theo Phase, không chỉ dừng ở tạo kế hoạch. Mỗi lần hoàn thành một Phase, tự rà các tiêu chí, commit và sang phase tiếp theo nếu không cần secrets/quyền mới. Khi cần tài khoản triển khai, xác nhận giao dịch, hoặc có rủi ro an toàn khó giải quyết, tạm dừng ngay tại điểm đó với yêu cầu cụ thể; **không** fake proof hoặc yêu cầu quyền quá mức.

### Prompt dán vào Codex/Continue trong VS Code

> You are the lead engineer for **REDLINE for NEAR**, NEAR Hackathon 2026. Read `NEAR_REDLINE_MIGRATION_PLAN_AGENT.md` fully before editing code, and verify the actual repository state. Your mission is to **implement the plan phase by phase**, not just rewrite documentation. Preserve the existing Solana project and Git history, keep attribution, and deliver a real NEAR Testnet security MVP. Start at Phase 0/1 depending on the current repo contents. Create a concise plan in `docs/NEAR_MIGRATION_PLAN.md`, then implement the first safe phase, run its tests, commit and report results with commands/proofs. Continue autonomously through subsequent phases when safe. Never use mainnet or expose secrets. Never confuse mocked results with on-chain proof. For transfers on NEAR, implement pending reservations, secure private callbacks, failure release, concurrency/replay protection and withdrawal safety. Consult the latest official NEAR docs before selecting versions or code patterns. At each phase report: completed work, changed files, tests, verified links, open risks, and next phase. If human approval or credentials are required, stop at that specific boundary rather than inventing a result.

## 10. Những điều tuyệt đối không được đánh tráo

- **Solana Devnet ≠ NEAR Testnet.** Không dùng Explorer Solana để chứng minh NEAR.
- **Rejection in UI/Mock ≠ rejection on-chain.** Demo buộc phải có proof chain mà người khác kiểm tra được.
- **Transaction submitted ≠ finalized successful.** Cần kiểm tra receipts/callback state.
- **Callback failure ≠ được phép giải phóng tiền ngay ngoài chain.** Chỉ finalize sau kết quả xác minh.
- **Repo mới ≠ code mới.** Phải chỉ ra phần mới của hackathon và giữ lịch sử/credit.
- **Agent suggestion ≠ user policy authorization.** AI không được override grants.
- **Testnet prototype ≠ audited mainnet financial product.** Không quảng bá sai mức an toàn.

## 11. Nguồn bắt buộc kiểm tra khi thực hiện

1. NEAR Hackathon, tracks/deadline/submission: <https://nearhackathon.com/>
2. Hackathon agent rules: <https://nearhackathon.com/HACKATHON.md>
3. NEAR Rust smart contract quickstart: <https://docs.near.org/smart-contracts/quickstart>
4. NEAR cross-contract calls, async receipt/callback: <https://docs.near.org/smart-contracts/anatomy/crosscontract>
5. NEAR SDK Rust API: <https://docs.rs/near-sdk/latest/near_sdk/>
6. NEAR official docs: <https://docs.near.org/>
7. REDLINE original README: <https://github.com/MinhNhat-2504/REDLINE/blob/main/README.md>
8. REDLINE security architecture: <https://github.com/MinhNhat-2504/REDLINE/blob/main/docs/TECHNICAL_ARCHITECTURE.md>

---

**Thước đo cuối cùng:** một người chưa biết REDLINE có thể clone repo **Public**, chạy README, xem giao dịch NEAR Testnet đã quyết toán, tự tạo intent vượt chính sách để thấy bị từ chối, và hiểu chính xác phần nào được kế thừa/phát triển mới. Nếu không làm được điều đó, chưa gọi là hoàn thành MVP.

## 12. Mẫu báo cáo bắt buộc sau mỗi phase (Agent Progress Report)

Sau khi thực hiện **mỗi phase** trong `docs/NEAR_MIGRATION_PLAN.md`, agent phải ghi hoặc cập nhật `docs/PROGRESS.md`. Không chỉ trả lời trong chat rồi mất dấu. Format đề xuất:

```markdown
# Phase N — [tên phase]
- Status: PASS / PARTIAL / BLOCKED / FAIL
- Date (UTC+7): YYYY-MM-DD
- Base commit: <sha>
- Final commit: <sha>
- Files changed: [paths]
- What inherited from Solana: [paths / commits]
- What is NEW for NEAR: [paths / specific behaviors]
- Commands executed: [real commands, not predicted commands]
- Tests: [test name, PASS/FAIL/NOT RUN, reason]
- NEAR Testnet: [account, contract address, tx hashes, receipt state] or NOT DEPLOYED
- Secrets used: [env variable names only; NEVER secret values]
- Security review: [threats tested, open findings]
- Known limitations: [specific nonworking features]
- Next phase: [ID, dependencies, what is needed]
```

### Quy tắc quyết định tiếp tục / tạm dừng

- **Tự tiếp tục:** unit tests pass; code review không phát hiện sai lệch policy; không cần chữ ký chủ ví hoặc credential mới; công việc chỉ tác động repo NEAR mới.
- **Tạm dừng và báo user:** cần thiết lập account Testnet, NEAR wallet ký giao dịch, quyền đẩy GitHub bị từ chối, secrets từ bên ngoài, thay đổi không tương thích có thể làm hỏng baseline, hoặc security flaw có thể dẫn tới chuyển tiền sai.
- **Không được báo PASS:** khi RPC timeout nhưng không có receipt xác nhận; khi chỉ chạy mock; khi kiểm thử không được cài dependencies; khi code đã viết nhưng build/test chưa chạy; khi callback outcome chưa được xác minh.
- **Khi chậm tiến độ:** cắt Agent Economy / NEP-141 / swap / trang trí UI trước; bảo vệ yêu cầu P0 gồm `SC-03`, `NET-01`, `QA-01`, `SUB-01`.

### Kiểm tra cuối trước khi gửi nộp bài

Agent tạo file `docs/SUBMISSION_AUDIT.md` với bằng chứng cho 8 điều kiện sau: (1) repo public có link truy cập không đăng nhập; (2) `README.md` mô tả chính xác phần mới và phần kế thừa; (3) demo có địa chỉ NEAR Testnet và transaction/receipt thật; (4) có ít nhất một giao dịch ALLOW và một REJECT on-chain; (5) không còn secrets được commit; (6) test commands và kết quả thực có thể tái tạo; (7) X post công khai có video/screenshot cùng hashtag/tag đúng; (8) thông tin team/credit và tài khoản NEAR được điền đúng theo form. Bất kỳ điều kiện nào chưa đạt phải được đánh dấu **BLOCKED**, không tự sửa báo cáo thành hoàn thành.
