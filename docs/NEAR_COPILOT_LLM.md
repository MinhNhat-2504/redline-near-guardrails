# Copilot LLM cho NEAR

Ngày 2026-11-05. Tích hợp chỉ đọc; mặc định tắt. Chưa có bằng chứng phản hồi model thật.

Owner walkthrough update: owner supplied screenshots showing enabled=true/Gemini/gemini-3.8-flash, authenticated web owner, historical revoked grant and deterministic REVOKED, then clicked the consented AI control and received generic API503. Configuration/render/click failure are owner-observed; no successful provider response or root cause independently captured. Do not treat that failed attempt as LLM acceptance PASS.

Diagnostic fix: copilot errors now return only a fixed whitelisted code, never raw provider bodies/keys. UI distinguishes SNAPSHOT_UNAVAILABLE, PROVIDER_KEY_REJECTED, PROVIDER_ACCESS_DENIED, PROVIDER_MODEL_UNAVAILABLE, PROVIDER_QUOTA, PROVIDER_REQUEST_REJECTED, PROVIDER_UNAVAILABLE, PROVIDER_TIMEOUT, RESPONSE_TRUNCATED, RESPONSE_BLOCKED and INVALID_RESPONSE. HTTP400 remains ambiguous (key/project/model/schema may need checking); no automatic key/model/token-limit/billing change or retry. Financial endpoint errors retain the prior uncertainty wording. Restart backend to use the compiled fix; a new owner-triggered request is needed to learn the current failure code.

Subsequent owner screenshots: copilot sign-in was rejected again immediately after reported re-login. Actual missing-header/DB-expiry/key-verification cause is not independently known; do not label it ordinary elapsed-session expiry. Source audit found a frontend HMR boundary: a cached lazy-wallet module can retain an older API module closure while the current API token variable has reset. The implementation now shares one token/revision object via Vite hot.data in RAM only, checks the current API /near/auth/me before showing a successful login, and ignores late401 invalidation from an older token revision. Synthetic tests cover old/new closures, fresh-page isolation, handshake identity/expiry and delayed401; this is not an actual browser HMR proof. Owner must F5 once to discard the already-loaded pre-fix modules, then sign in once to check the new handshake. Backend configuration and Gemini key do not need changing.

Next owner screenshots show authenticated web account after the fix, then PROVIDER_UNAVAILABLE rather than an invalid-session banner. This owner-operated attempt reached the model error branch; it is not successful LLM acceptance or independent confirmation of the earlier HMR root cause. Agent ran two unauthenticated Node reachability probes without keys: GET Google API root returned404 in161ms; POST empty JSON to generateContent without API key returned403 in151ms. These prove transport reachability for those unauthenticated probes only, not model access or successful authenticated inference.

Transport diagnostics refinement: fetch/read failures now distinguish known DNS, certificate, socket/reset and timeout codes; HTTP500/502/503/504 have separate fixed codes, and an invalid non-ASCII/whitespace header key gets a local config error before fetch. No raw error strings, IPs, proxy configuration, key or provider body is returned. No TLS bypass, proxy change, automatic retry, model switch or spending-limit increase was introduced. Original PROVIDER_UNAVAILABLE remains insufficient to reconstruct the prior error retrospectively. A current owner-triggered attempt after backend restart is still needed.

Next owner screenshot showed PROVIDER_TIMEOUT with the old15-second message. That code can also represent an earlier network/connect timeout; the screenshot alone does not establish Google received the request or that reasoning was the cause. Default provider deadline is now45seconds, optionally bounded by NEAR_COPILOT_TIMEOUT_MS=15000..60000. Existing output1200tokens/body32KiB/quota/no-retry controls remain unchanged. For the explicitly configured gemini-3.8-flash only, generationConfig requests thinkingLevel=low and includeThoughts=false; other models do not receive that model-specific setting. Removed candidateCount, retaining strict one-candidate response validation. Official references: [thinking REST examples](https://ai.google.dev/gemini-api/docs/generate-content/thinking?hl=en), [3.8 migration guidance](https://ai.google.dev/gemini-api/docs/latest-model). This is a bounded latency/configuration adjustment, not proof the real provider timeout has been resolved. Slower/lower-level connection timeouts can still occur before the45second cap. No need to edit the owner's .env to get the new default; restart backend to load the rebuilt code.

## Luồng đã triển khai

Trong **Policy Lab**, phân tích bằng quy tắc trước. Phần **Hỏi copilot về đề xuất này** cho chọn giải thích kết quả, rủi ro hoặc bước kiểm tra tiếp theo. Chủ grant đăng nhập, đồng ý gửi dữ liệu và chủ động bấm **Hỏi AI · không ký giao dịch**.

Backend đọc lại grant/ledger/intent tại cùng một block FINAL trước mỗi lời gọi. Model chỉ nhận network, block height, số tiền, nonce, cap, cooldown, các số liệu kế toán cần thiết và gate. Không gửi địa chỉ ví, người nhận, contract, grant ID, intent ID, policy hash, chữ ký, session hoặc khóa. Snapshot mới có thể khác snapshot trước đó; UI ghi riêng provenance và kết luận quy tắc của lần đọc mới.

LLM chỉ sinh `summary`, `risks`, `nextSteps`. Kết luận `predicted` lấy từ evaluator, không lấy từ AI. Phản hồi không có transaction/tool/authorization, không được chuyển thành intent. Văn bản AI được React escape, không render HTML/Markdown/link. Model vẫn có thể bịa hoặc khuyên sai; việc giữ riêng quyền thực thi không chứng minh nội dung AI luôn đúng. Không dùng prompt như một ranh giới bảo mật duy nhất.

Adapter NEAR tách khỏi client LLM cũ để tránh log khóa, lỗi provider và fallback tự động. Gemini endpoint cố định, key chỉ ở header, từ chối redirect, deadline mặc định45 giây (cấu hình trong khoảng15..60 giây), output tối đa1200 token, body response tối đa32KiB, schema kiểm tra lại ở backend/frontend. Chỉ dùng phần final text, không trả thought/signature của provider. HTTP lỗi, JSON lỗi, truncated/refusal/không có final answer trả lỗi có kiểm soát; không giả làm phản hồi thật bằng câu trả lời mẫu.

API `GET /near/copilot/status` chỉ trả enabled/provider/model. `POST /near/copilot/explain` yêu cầu session chủ grant và consent=true; không nhận owner/policy override. Một yêu cầu trong tiến trình tại một thời điểm; tối đa3 lần/phút/chủ,20 lần/giờ/tiến trình, tính cả lỗi và không tự retry. Đây là giới hạn tiến trình, không phải quota bền vững hay cam kết mức tiền: restart/nhiều replica có quota riêng. Khi triển khai công khai cần quota/billing/provider restriction ở tài khoản và limiter dùng chung.

## Cấu hình do chủ máy thực hiện

Không gửi khóa API cho coding agent hoặc vào chat. Không đặt khóa trong `VITE_*`, frontend, Git hoặc ảnh chụp. Agent chưa đọc file `.env`/khóa provider và không thực hiện lời gọi tính phí.

1. Nếu chọn Gemini, tạo/quản lý khóa trong [Google AI Studio](https://aistudio.google.com/api-keys). Xem [model đang được hỗ trợ](https://ai.google.dev/gemini-api/docs/models), chọn model hỗ trợ JSON structured output; code không tự đoán model hoặc bảo đảm quyền truy cập.
2. Tại `backend/.env` đã được Git ignore, chủ máy tự cấu hình ba tên biến sau. Không ghi đè các biến DB/NEAR hiện có:

```dotenv
NEAR_COPILOT_ENABLED=true
NEAR_COPILOT_MODEL=<model-id-chu-may-chon>
GEMINI_API_KEY=<khoa-chi-luu-tren-backend>
```

3. Backend nạp `.env` từ thư mục `backend` khi khởi động. Dừng bằng Ctrl+C rồi chạy lại `./scripts/start-near-local.ps1` từ thư mục đó. Bản build mới đã được tạo. Giữ Vite đang chạy, F5, đăng nhập đúng `.testnet`. Không cần nạp tiền, reset khóa hoặc tạo grant mới: grant đã thu hồi vẫn giải thích được.
4. Vào **Quyền agent**, đọc grant đã có; sang **Policy Lab**, bấm **Phân tích · chỉ đọc**. Chọn chủ đề, đọc nội dung đồng ý chia sẻ dữ liệu/có thể tính phí rồi bấm **Hỏi AI** đúng một lần. Đây chỉ gọi model, không mở ví ký giao dịch.
5. Nếu lỗi, giữ nguyên các yêu cầu tài chính. Không tăng cap/reset khóa/nạp tiền để sửa lỗi model. Tắt `NEAR_COPILOT_ENABLED=false` và restart để chỉ dùng evaluator.

Việc bật provider, cung cấp khóa và chấp nhận gửi dữ liệu ra Gemini cần chủ máy thực hiện. Chưa bật thay bạn, chưa kiểm tra số dư/billing hoặc model access. Giao diện desktop/mobile và lời gọi model thật vẫn cần kiểm tra thực tế.

## Bằng chứng kiểm thử

Các test provider dùng transport giả, không phải Gemini thật. Kiểm tra disabled mặc định, config sai, dữ liệu egress không có định danh, chủ grant, consent/schema, lỗi RPC, quota/concurrency, lỗi HTTP/timeout/truncated/JSON/body quá lớn, thought filtering, tách verdict khỏi văn bản AI, text escaping và không có financial action. Các log tổng hợp: `docs/evidence/phase5-copilot-*.log`. Số test cuối được ghi trong PROGRESS sau khi lệnh hoàn tất. Không thay contract, schema DB, dependency hay khóa executor.

Nguồn giao thức được đối chiếu: [GenerateContent REST](https://ai.google.dev/api/generate-content), [Structured output](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest). Kiểm tra schema cục bộ vẫn bắt buộc; chưa coi cấu trúc response mock là bằng chứng tương thích model thực tế.
