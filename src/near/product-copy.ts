// Presentation only: raw protocol states remain available for receipt verification.
export const stateLabels: Record<string, string> = {
  SETTLED: "Đã chuyển tiền", CONFIRMED: "Đã xác nhận", REJECTED: "Đã chặn",
  REVOKED: "Đã thu hồi", BLOCK: "Bị chặn", FAILED: "Không thành công",
  ERROR: "Có lỗi", UNKNOWN: "Chưa rõ kết quả", PENDING: "Đang chờ xác nhận",
  PASS: "Đạt", CONNECTED: "Đã kết nối",
};
export const reasonLabels: Record<string, string> = {
  REVOKED: "Quyền đã bị thu hồi", EXPIRED: "Quyền đã hết hạn",
  NONCE_REPLAY: "Yêu cầu dùng lại số thứ tự", ASSET_NOT_ALLOWED: "Loại tiền không được phép",
  DESTINATION_NOT_ALLOWED: "Người nhận ngoài danh sách", TX_CAP_EXCEEDED: "Vượt số lần cho phép",
  SPEND_CAP_EXCEEDED: "Vượt ngân sách", COOLDOWN_ACTIVE: "Chưa hết thời gian chờ",
  POLICY_HASH_MISMATCH: "Quy tắc không khớp", INVALID_AMOUNT: "Số tiền không hợp lệ",
  INSUFFICIENT_BALANCE: "Quỹ không đủ tiền khả dụng", ALLOW: "Trong giới hạn đã cấp",
};
