# Rút tiền qua giao diện NEAR

Ngày 2026-11-05. Thay đổi tiếp theo sau workspace redesign; contract, khóa executor và schema DB không thay đổi.

## Hành vi đã triển khai

- Trong **Ví & quỹ**, chủ ví đọc quỹ, nhập số NEAR, chọn **Xem đề xuất rút tiền**. Đề xuất chưa ký và có thể hủy.
- Màn hình xem lại hiển thị riêng số rút, chính ví nhận, mã rút duy nhất, contract và khoản gửi kèm bằng 0. Gas trả từ ví. Chỉ principal khả dụng được rút; storage và các khoản giữ chỗ không được tính.
- Ngay trước khi mở ví, đọc lại ledger và lưu bản ghi công khai `near-owner-withdrawal-attempt`, kiểm tra đọc lại thành công. Không tự gửi khi reload. Không cho thay thế bằng lần rút khác khi còn bản ghi.
- Khi ví trả hash, gọi API có xác thực `POST /near/withdrawals/reconcile`. API kiểm tra đúng signer/contract/action/gas/deposit/id/amount, receipt FINAL, sự kiện callback, block thực thi mới hơn baseline và view `get_withdrawal` khớp kết quả.
- Chỉ xóa bản ghi sau FINAL `SETTLED` hoặc `FAILED` có callback khớp. `FAILED` nghĩa là lần chuyển thất bại đã được callback xử lý, không phải rút thành công. `UNKNOWN`, timeout, thiếu hash, lỗi runtime và receipt không khớp tiếp tục giữ bản ghi.
- Reload khôi phục cùng mã/số tiền/hash. Có thể nhập hash công khai lấy từ lịch sử ví rồi **Đối soát lần rút · không ký**. Đăng nhập sai tài khoản không thể đối soát cho chủ ví khác.
- Nếu đã mở ví rồi hủy/đóng mà không có hash, giữ nguyên bản ghi và dừng điều tra. Không có nút xóa để ký lại; không coi timeout là bằng chứng giao dịch chưa tồn tại. Multi-tab localStorage vẫn không phải khóa nguyên tử.

## Kiểm tra thực sự đã chạy

Frontend: 342 test/36 file, typecheck/build PASS. Backend: 561 test/40 file, typecheck/direct tsc build PASS. Postgres: 26 test tích hợp trong container tạm PASS; không dùng DB của chủ ví. Log: `docs/evidence/phase4-withdrawal-*.log`.

37 test frontend mới kiểm tra số thập phân/u128, tiền khả dụng, đề xuất bị sửa, lưu trước khi ký, reload/thiếu hash, không thay hash, callback FINAL khớp và bản ghi hỏng. 14 test backend mới dùng receipt CLI Phase 2 đã lưu và các biến thể lỗi tổng hợp để kiểm tra đối soát và xác thực. Đây không phải bằng chứng một lần rút qua trình duyệt mới. Bản build cuối được kiểm tra lại sau chỉnh hướng dẫn điều hướng và làm mới số dư.

Không chạy giao dịch tài chính mới, không đọc khóa/session, không yêu cầu nạp tiền, không đổi contract hoặc quyền executor. Chưa có công cụ browser để kiểm thử popup/desktop/mobile tự động; các nhánh trình duyệt thực tế vẫn NOT RUN. Cảnh báo chunk wallet trên 500kB vẫn còn.

## Khi chủ ví muốn thử giao diện

1. Khởi động lại backend đang dùng để nạp API mới: trong thư mục `backend`, chạy `./scripts/start-near-local.ps1`. Giữ cửa sổ này mở. Frontend giữ nguyên Vite đang chạy, F5 và mở `/near#/vault`.
2. Đăng nhập `.testnet`, **Làm mới quỹ của tôi**, nhập số nhỏ trong principal hiện có. Chưa cần ký để xem và hủy đề xuất.
3. Chỉ khi chủ động muốn rút thật trên Testnet, kiểm tra số tiền/ví nhận rồi mở ví và tự ký. Không nạp lại, không reset khóa. Kết quả chưa rõ thì dùng đúng mã/hash để đối soát, không tạo mã khác.

Thử ký bước 3 là hành động của chủ ví; chưa được thực hiện hay đánh dấu PASS trong phiên phát triển này.


## 2026-11-06 - Owner browser withdrawal checks before wallet signing

Owner supplied chat screenshots from the redesigned wallet view for nhat-redline-web.testnet. Observed: available principal 0.09 NEAR and storage 0.04498 NEAR; unsigned withdrawal review for 0.01 NEAR showed that owner as signer/recipient, nhat-redline-vault.testnet as contract, and zero attached deposit plus gas. Following the instructed Cancel step, the next screenshot shows the review closed and the same balances. Following the instructed F5-before-opening-wallet step, the next screenshot shows signed-out UI without the review. After owner re-login and balance refresh, screenshots show the same balances, normal withdrawal input/button and no pending-withdrawal panel. Following the instructed 0.10 NEAR over-balance check, the final screenshot shows the controlled available-principal error and unchanged displayed balances.

These specific manual cases are PASS_OWNER_OBSERVED for visible unsigned review/cancel, reload-before-wallet and over-balance rejection. Screenshots are supplied in chat, not archived local image files. They do not independently capture all clicks, localStorage, HTTP traffic, receipt status or prove absence of chain transactions. No actual browser withdrawal, financial-wallet cancellation, after-signing reload or new FINAL withdrawal receipt is established. Phase4/5 remain PARTIAL. Agent did not read credentials/session files, call a model, request funding or submit a financial transaction. Documentation/evidence only; application source unchanged, tests/builds not rerun. Earlier automated results remain historical evidence, not new runs.


## 2026-11-06 - Browser withdrawal independently verified through public Testnet RPC

Owner signed the reviewed 0.01 NEAR withdrawal and supplied https://explorer.testnet.near.org/transactions/AwCQh5ceQyom6WM46TkmaDdJG2AFBFQwvvcu8KrWcMHp . Public-only verifier backend/scripts/verify-near-web-withdrawal.ts ran successfully, checked Testnet identity, exact owner nhat-redline-web.testnet, vault nhat-redline-vault.testnet, single withdraw action, 100 Tgas, deposit0, withdrawal ID wd-e12b9f4c0b2b43fa970643db7d0970f8 and amount10000000000000000000000 yoctoNEAR. Production receipt observation confirms FINAL SETTLED and matching withdrawal_completed callback with no failed receipt accepted as success. Stored get_withdrawal and owner ledger were read at the same FINAL block276474423: status SETTLED, credited0.1/spent0.01/completed_withdrawals0.01, pending_reserved0/pending_withdrawals0, available0.08 NEAR, storage0.04404 NEAR. Raw transaction, receipt outcomes, callback execution block and pinned views: docs/evidence/phase4-web-withdrawal-final.json. This snapshot supersedes the prior available0.09/withdrawals0 snapshot for this owner.

Actual browser withdrawal acceptance now has owner screenshot plus independent public receipt/callback/stored-view proof. Original browser durable-attempt baseline, complete click/network trace and exact historical wallet before/after balance delta are not independently captured. No financial-wallet cancellation or post-signing reload acceptance inferred. Earlier zero-amount trial screenshot also shows controlled positive-amount validation with balances unchanged (owner-observed only). Phase4/5 remain PARTIAL for remaining broader acceptance/security/CI/provider reliability work.

Checks run:14 backend withdrawal regression tests PASS; backend typecheck and direct tsc build PASS (phase4-web-withdrawal-verifier-tests.log). Actual public verification PASS; initial sandbox tsx launch failed spawn EPERM, then authorized execution succeeded. Frontend, Postgres, Rust and audits not rerun: production application source/schema/dependencies/contract unchanged; only a read-only verifier and documentation added. No key/session/.env read, model invocation, signing or financial broadcast by agent; user-modified login report excluded. No remote push attempted.
