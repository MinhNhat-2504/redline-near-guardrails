const messages: Record<string, string> = {
  SNAPSHOT_UNAVAILABLE: "Chưa đọc được snapshot FINAL từ NEAR RPC. Chưa có phản hồi AI; thử đọc snapshot trước.",
  PROVIDER_KEY_REJECTED: "Gemini từ chối khóa API. Kiểm tra khóa tại backend; không gửi khóa vào chat.",
  PROVIDER_ACCESS_DENIED: "Gemini từ chối quyền truy cập. Kiểm tra project, giới hạn khóa và quyền dùng model trong AI Studio.",
  PROVIDER_MODEL_UNAVAILABLE: "Gemini không tìm thấy model hoặc tài khoản chưa có quyền dùng model đã cấu hình.",
  PROVIDER_QUOTA: "Gemini báo hết hạn mức hoặc quá nhiều yêu cầu. Kiểm tra quota trong AI Studio; chưa bấm gọi liên tục.",
  PROVIDER_REQUEST_REJECTED: "Gemini từ chối yêu cầu (HTTP 400). Cần kiểm tra khóa/project, model và định dạng JSON; mã này chưa đủ xác định nguyên nhân cụ thể.",
  PROVIDER_UNAVAILABLE: "Chưa kết nối được Gemini hoặc dịch vụ đang lỗi. Chưa có câu trả lời AI hợp lệ.",
  PROVIDER_TIMEOUT: "Gemini chưa trả xong trong 15 giây. Không có lượt gọi lại tự động.",
  RESPONSE_TRUNCATED: "Gemini đã trả lời nhưng chạm giới hạn token trước khi hoàn tất JSON. Chưa hiển thị câu trả lời chưa hoàn chỉnh.",
  RESPONSE_BLOCKED: "Gemini chặn phản hồi cho yêu cầu này. Chưa có câu trả lời AI hợp lệ.",
  INVALID_RESPONSE: "Phản hồi Gemini không đúng cấu trúc cần thiết hoặc quá lớn. Chưa dùng nội dung đó để kết luận.",
};
export function copilotErrorMessage(code: unknown): string | undefined { return typeof code === "string" && Object.hasOwn(messages, code) ? messages[code] : undefined; }
