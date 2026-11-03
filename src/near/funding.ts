import { MIN_OWNER_STORAGE, PRINCIPAL_FUNDING, STORAGE_FUNDING, type Ledger } from "./model";
export type FundingMethod = "storage_deposit" | "deposit";
export type FundingStatus = { registered: false; blockHeight: number; blockHash: string } | { registered: true; value: Ledger; blockHeight: number; blockHash: string };
export type FundingAttempt = { id: string; owner: string; method: FundingMethod; amount: string; beforeHeight: number; hash?: string };
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = "near-owner-funding-attempt";
const hashOk = (v: unknown): v is string => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
export function parseFundingStatus(value: unknown): FundingStatus {
  const s = value as any;
  if (!s || typeof s.registered !== "boolean" || !Number.isSafeInteger(s.blockHeight) || s.blockHeight < 0 || !hashOk(s.blockHash)) throw Error("Snapshot funding không hợp lệ; chưa cho phép ký.");
  if (!s.registered) { if (s.value !== undefined) throw Error("Không dùng số dư giả cho tài khoản chưa đăng ký."); return { registered: false, blockHeight: s.blockHeight, blockHash: s.blockHash }; }
  const names = ["credited", "finalized_spent", "pending_reserved", "completed_withdrawals", "pending_withdrawals", "storage_available"];
  const v = s.value;
  if (!v || names.some(k => typeof v[k] !== "string" || !/^(0|[1-9][0-9]*)$/.test(v[k]) || v[k].length > 39 || BigInt(v[k]) >= (1n << 128n))) throw Error("Ledger funding không hợp lệ.");
  if (BigInt(v.credited) < BigInt(v.finalized_spent) + BigInt(v.pending_reserved) + BigInt(v.completed_withdrawals) + BigInt(v.pending_withdrawals)) throw Error("Ledger funding không bảo toàn số dư.");
  return { registered: true, value: Object.fromEntries(names.map(k => [k, v[k]])) as Ledger, blockHeight: s.blockHeight, blockHash: s.blockHash };
}
export function fundingAmount(method: FundingMethod) { return method === "storage_deposit" ? STORAGE_FUNDING : PRINCIPAL_FUNDING; }
export function assertFundingNeeded(method: FundingMethod, status: FundingStatus) {
  if (method === "storage_deposit") { if (status.registered && BigInt(status.value.storage_available) >= BigInt(MIN_OWNER_STORAGE)) throw Error("Storage đã đủ cho demo; không nạp lại."); }
  else if (!status.registered || status.value.credited !== "0") throw Error("Cần đăng ký storage trước. Nếu đã có khoản nạp principal, không tự nạp bù.");
}
export function restoreFunding(storage: StoragePort): FundingAttempt | undefined {
  const raw = storage.getItem(key); if (raw === null) return;
  try {
    const a = JSON.parse(raw);
    if (!a || !/^fund-[a-f0-9]{32}$/.test(a.id) || typeof a.owner !== "string" || a.owner.length < 2 || a.owner.length > 64 || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(a.owner) || !["storage_deposit", "deposit"].includes(a.method) || a.amount !== fundingAmount(a.method) || !Number.isSafeInteger(a.beforeHeight) || a.beforeHeight < 0 || (a.hash !== undefined && !hashOk(a.hash)) || Object.keys(a).some(k => !["id", "owner", "method", "amount", "beforeHeight", "hash"].includes(k))) throw Error();
    return { id: a.id, owner: a.owner, method: a.method, amount: a.amount, beforeHeight: a.beforeHeight, ...(a.hash ? { hash: a.hash } : {}) };
  } catch { throw Error("Đề xuất funding đã lưu không hợp lệ; giữ nguyên dữ liệu, chưa ký lại."); }
}
export function assertNoFundingAttempt(storage: StoragePort) { if (storage.getItem(key) !== null) throw Error("Có funding cần đối soát; khôi phục đề xuất trước khi ký giao dịch khác."); }
function save(storage: StoragePort, a: FundingAttempt) {
  const raw = JSON.stringify(a); storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw Error("Chưa lưu chắc chắn đề xuất funding; chưa ký."); return a;
}
export function beginFunding(storage: StoragePort, owner: string, method: FundingMethod, status: FundingStatus) {
  status = parseFundingStatus(status);
  if (!/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(owner) || owner.length < 2 || owner.length > 64) throw Error("Sai tài khoản funding.");
  assertNoFundingAttempt(storage); assertFundingNeeded(method, status);
  return save(storage, { id: `fund-${crypto.randomUUID().replaceAll("-", "")}`, owner, method, amount: fundingAmount(method), beforeHeight: status.blockHeight });
}
export function recordFundingHash(storage: StoragePort, a: FundingAttempt, hash: string) {
  if (!hashOk(hash) || JSON.stringify(restoreFunding(storage)) !== JSON.stringify(a) || (a.hash && a.hash !== hash)) throw Error("Hash funding không hợp lệ hoặc khác lần ký đã lưu.");
  return save(storage, { ...a, hash });
}
export function completeFunding(storage: StoragePort, a: FundingAttempt, result: any) {
  if (!a.hash || result.transactionHash !== a.hash || result.finalized !== true || result.state !== "CONFIRMED" || result.method !== a.method || result.amount !== a.amount || !Number.isSafeInteger(result.executionBlockHeight) || result.executionBlockHeight <= a.beforeHeight || JSON.stringify(restoreFunding(storage)) !== JSON.stringify(a)) throw Error("Chưa có FINAL funding đúng đề xuất; giữ nguyên lần ký, không ký lại.");
  storage.removeItem(key); if (storage.getItem(key) !== null) throw Error("Chưa hoàn tất lưu trạng thái funding.");
}
