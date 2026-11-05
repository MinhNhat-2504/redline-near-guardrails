const messages: Record<string, string> = {
  PROVIDER_COOLDOWN: "Copilot đang tạm nghỉ sau lỗi dịch vụ Gemini. Phân tích bằng quy tắc vẫn dùng được; không tự gọi lại AI.",
  PROVIDER_CONFIG_INVALID: "Khóa cấu hình có ký tự không hợp lệ để gửi trong HTTP header. Kiểm tra lại dòng GEMINI_API_KEY tại máy; không gửi khóa vào chat.",
  PROVIDER_NETWORK_ERROR: "Node không hoàn tất được kết nối tới Gemini. Chưa nhận được HTTP response; cần kiểm tra đường mạng của backend.",
  PROVIDER_DNS_ERROR: "Backend không phân giải được tên miền Gemini (DNS). Chưa có phản hồi AI.",
  PROVIDER_TLS_ERROR: "Node không xác minh được chứng chỉ HTTPS của Gemini. Cần kiểm tra chứng chỉ/proxy; không tắt xác minh TLS.",
  PROVIDER_CONNECTION_RESET: "Kết nối backend tới Gemini bị ngắt hoặc bị từ chối. Kiểm tra mạng/proxy/firewall của máy.",
  PROVIDER_HTTP_500: "Gemini trả HTTP 500: lỗi xử lý phía dịch vụ. Chưa có câu trả lời AI hợp lệ; không tự gọi lại.",
  PROVIDER_HTTP_502: "Gemini hoặc gateway trả HTTP 502. Chưa có câu trả lời AI hợp lệ; không tự gọi lại.",
  PROVIDER_HTTP_503: "Gemini trả HTTP 503: dịch vụ hiện không sẵn sàng. Giữ nguyên cấu hình; không bấm gọi liên tục.",
  PROVIDER_HTTP_504: "Gemini hoặc gateway trả HTTP 504: hết thời gian chờ phía dịch vụ. Chưa có câu trả lời AI hợp lệ.",
  SNAPSHOT_UNAVAILABLE: "Chưa đọc được snapshot FINAL từ NEAR RPC. Chưa có phản hồi AI; thử đọc snapshot trước.",
  PROVIDER_KEY_REJECTED: "Gemini từ chối khóa API. Kiểm tra khóa tại backend; không gửi khóa vào chat.",
  PROVIDER_ACCESS_DENIED: "Gemini từ chối quyền truy cập. Kiểm tra project, giới hạn khóa và quyền dùng model trong AI Studio.",
  PROVIDER_MODEL_UNAVAILABLE: "Gemini không tìm thấy model hoặc tài khoản chưa có quyền dùng model đã cấu hình.",
  PROVIDER_QUOTA: "Gemini báo hết hạn mức hoặc quá nhiều yêu cầu. Kiểm tra quota trong AI Studio; chưa bấm gọi liên tục.",
  PROVIDER_REQUEST_REJECTED: "Gemini từ chối yêu cầu (HTTP 400). Cần kiểm tra khóa/project, model và định dạng JSON; mã này chưa đủ xác định nguyên nhân cụ thể.",
  PROVIDER_UNAVAILABLE: "Chưa kết nối được Gemini hoặc dịch vụ đang lỗi. Chưa có câu trả lời AI hợp lệ.",
  PROVIDER_TIMEOUT: "Hết thời gian chờ khi kết nối hoặc nhận phản hồi Gemini. Không có lượt gọi lại tự động.",
  RESPONSE_TRUNCATED: "Gemini đã trả lời nhưng chạm giới hạn token trước khi hoàn tất JSON. Chưa hiển thị câu trả lời chưa hoàn chỉnh.",
  RESPONSE_BLOCKED: "Gemini chặn phản hồi cho yêu cầu này. Chưa có câu trả lời AI hợp lệ.",
  INVALID_RESPONSE: "Phản hồi Gemini không đúng cấu trúc cần thiết hoặc quá lớn. Chưa dùng nội dung đó để kết luận.",
};
export function copilotErrorMessage(code: unknown): string | undefined { return typeof code === "string" && Object.hasOwn(messages, code) ? messages[code] : undefined; }
export function copilotRetrySeconds(value: unknown): number | undefined { return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 300 ? value : undefined; }
export function remainingCopilotCooldown(until: number, now = Date.now()): number { return Number.isFinite(until) ? Math.max(0, Math.min(300, Math.ceil((until - now) / 1000))) : 0; }
