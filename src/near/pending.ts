import type { Grant } from "./model";

export type IntentRequest = { grant_id: string; intent_id: string; nonce: string; asset: "NEAR"; recipient: string; amount: string; policy_hash: string };
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type JournalRow = { hash: string; signerId?: string; grantId?: string | null; intentId?: string | null; state: string; reason?: string | null; observation?: unknown };
const key = "near-pending-request";
const fields = ["grant_id", "intent_id", "nonce", "asset", "recipient", "amount", "policy_hash"];
const id = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const uint = (v: unknown, bits: number) => typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v) && v.length <= 39 && BigInt(v) < (1n << BigInt(bits));

/** Treat persisted JSON as untrusted, including an earlier application's request. */
export function parsePending(value: unknown): IntentRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Request đã lưu không hợp lệ; giữ nguyên dữ liệu để kiểm tra.");
  const r = value as Record<string, unknown>;
  if (Object.keys(r).length !== fields.length || fields.some(f => !Object.hasOwn(r, f)) || !id(r.grant_id) || !id(r.intent_id) ||
      r.asset !== "NEAR" || !uint(r.nonce, 64) || !uint(r.amount, 128) || BigInt(r.amount as string) === 0n ||
      typeof r.recipient !== "string" || r.recipient.length < 2 || r.recipient.length > 64 || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(r.recipient) ||
      typeof r.policy_hash !== "string" || !/^[a-f0-9]{64}$/.test(r.policy_hash)) throw Error("Request đã lưu sai schema; chưa gửi hoặc thay thế request.");
  return { grant_id: r.grant_id as string, intent_id: r.intent_id as string, nonce: r.nonce as string, asset: "NEAR", recipient: r.recipient, amount: r.amount as string, policy_hash: r.policy_hash };
}
export function restorePending(storage: StoragePort): IntentRequest | undefined {
  const saved = storage.getItem(key);
  if (saved === null) return;
  try { return parsePending(JSON.parse(saved)); } catch { throw Error("Không khôi phục được request đã lưu. Dữ liệu được giữ lại; chưa tạo request khác."); }
}
export function persistPending(storage: StoragePort, value: unknown): IntentRequest {
  const request = parsePending(value);
  if (storage.getItem(key) !== null) throw Error("Có request đã lưu. Khôi phục và đối soát trước khi tạo ý định khác.");
  const encoded = JSON.stringify(request);
  storage.setItem(key, encoded);
  if (storage.getItem(key) !== encoded) throw Error("Trình duyệt chưa lưu chắc chắn request; chưa cho phép gửi.");
  return request;
}
export function assertRequestBinding(value: unknown, grantId: string, owner: string, grant?: Grant): asserts value is IntentRequest {
  const r = parsePending(value);
  if (!owner || !grant || grant.owner !== owner || r.grant_id !== grantId || r.policy_hash !== grant.policy.policy_hash) throw Error("Tải đúng grant và policy của tài khoản đang đăng nhập trước khi gửi.");
}
export function canComplete(request: IntentRequest, rows: JournalRow[]): boolean {
  return rows.some(row => {
    if (row.grantId !== request.grant_id || row.intentId !== request.intent_id || !["SETTLED", "REJECTED", "FAILED"].includes(row.state)) return false;
    try {
      const o = typeof row.observation === "string" ? JSON.parse(row.observation) : row.observation;
      if (!o || o.finalized !== true || o.state !== row.state || o.transactionHash !== row.hash || !Array.isArray(o.events)) return false;
      const name = row.state === "REJECTED" ? "intent_rejected" : "intent_completed";
      return o.events.some((event: any) => event.event === name && Array.isArray(event.data) && event.data.some((d: any) => d?.grant_id === request.grant_id && d?.intent_id === request.intent_id && d?.intent?.status === row.state && d.intent.amount === request.amount && d.intent.recipient === request.recipient && d.intent.nonce === request.nonce));
    } catch { return false; }
  });
}
export function completePending(storage: StoragePort, request: IntentRequest, rows: JournalRow[]) {
  if (!canComplete(request, rows) || JSON.stringify(restorePending(storage)) !== JSON.stringify(request)) throw Error("Chưa có kết quả FINAL khớp request đã lưu; giữ nguyên intent để đối soát.");
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw Error("Chưa xóa được request đã hoàn tất khỏi trình duyệt.");
}
