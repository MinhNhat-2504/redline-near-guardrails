import { available, CAP, MIN_OWNER_STORAGE, type Grant } from "./model";
import type { FundingStatus } from "./funding";
export type AccountSnapshot = { network: "testnet"; accountId: string; amount: string; locked: string; storageUsage: number; blockHeight: number; blockHash: string };
export function parseAccountSnapshot(value: unknown, owner: string): AccountSnapshot {
  const v = value as AccountSnapshot;
  const integer = (n: unknown) => typeof n === "string" && /^(0|[1-9][0-9]*)$/.test(n) && n.length <= 39 && BigInt(n) < (1n << 128n);
  if (!v || v.network !== "testnet" || v.accountId !== owner || !integer(v.amount) || !integer(v.locked) || !Number.isSafeInteger(v.storageUsage) || v.storageUsage < 0 || !Number.isSafeInteger(v.blockHeight) || v.blockHeight < 0 || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.blockHash)) throw Error("Snapshot số dư ví không hợp lệ; hãy đọc lại.");
  return v;
}
export function nextStep(s: { ready: boolean; owner: string; funds?: FundingStatus; grant?: Grant; pendingFunding: boolean; pendingRequest: boolean; requestFinal: boolean; now: number }) {
  if (!s.ready) return { target: "near-setup", text: "Kiểm tra backend tại 127.0.0.1:8787/health. Trang giao diện chạy ở localhost:5173/near." };
  if (!s.owner) return { target: "near-owner", text: "Đăng nhập bằng tài khoản .testnet trong Intear. Chỉ ký thông điệp đăng nhập; chưa chuyển tiền." };
  if (s.pendingFunding) return { target: "near-owner", text: "Khôi phục và đối soát lần ký funding đã lưu. Không ký hoặc nạp lại khi kết quả chưa rõ." };
  if (s.pendingRequest) return { target: "near-intents", text: s.requestFinal ? "Đã có kết quả FINAL. Bấm chuẩn bị case tiếp để kết thúc request cũ." : "Giữ cùng intent và đối soát kết quả. Không tạo ID thay thế khi UNKNOWN/PENDING." };
  if (s.grant?.owner === s.owner && !s.grant.active) return { target: "near-history", text: "Grant đã thu hồi. Xem lịch sử và bằng chứng; không cần nạp lại để kiểm tra demo đã hoàn tất." };
  if (!s.funds) return { target: "near-owner", text: "Bấm đọc vault của ví đăng nhập để biết đã có storage/principal hay chưa." };
  if (!s.funds.registered || BigInt(s.funds.value.storage_available) < BigInt(MIN_OWNER_STORAGE)) return { target: "near-owner", text: "Chuẩn bị đề xuất storage 0,05 NEAR Testnet, xem lại rồi chủ động ký một lần trong ví." };
  if (s.funds.value.credited === "0") return { target: "near-owner", text: "Storage đã có. Chuẩn bị principal 0,1 NEAR Testnet và ký riêng sau khi xem lại." };
  if (!s.grant || s.grant.owner !== s.owner) return { target: "near-grant", text: "Đọc grant thuộc ví này nếu đã ký trước đó. Chỉ chuẩn bị grant mới khi cần bắt đầu demo mới." };
  if (BigInt(s.grant.policy.expires_at_ns) <= BigInt(s.now) * 1000000n) return { target: "near-history", text: "Grant đã hết hạn. Xem lịch sử; đăng nhập lại không gia hạn grant và không cần nạp lại." };
  if (BigInt(available(s.funds.value)) < BigInt(CAP) && s.grant.finalized_transactions === 0) return { target: "near-owner", text: "Principal không đủ cho cap demo. Kiểm tra ledger trước; trang không tự nạp bù." };
  return { target: "near-intents", text: s.grant.finalized_transactions > 0 ? "ALLOW đã được quyết toán. Chuẩn bị ca vượt cap, sai người nhận hoặc replay; xem request trước mỗi lần gửi." : "Grant sẵn sàng. Chuẩn bị ALLOW 0,01 NEAR, xem request rồi gửi một lần." };
}
export function explorerUrl(hash: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash)) throw Error("Transaction hash không hợp lệ.");
  return `https://explorer.testnet.near.org/transactions/${hash}`;
}
