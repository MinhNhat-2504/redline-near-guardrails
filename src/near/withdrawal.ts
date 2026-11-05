import { available, CONTRACT, type Ledger, type Proposal } from "./model";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type WithdrawalAttempt = { owner: string; withdrawalId: string; amount: string; beforeHeight: number; hash?: string };
export const withdrawalKey = "near-owner-withdrawal-attempt";
const hashOk = (v: unknown): v is string => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const positive = (v: unknown): v is string => typeof v === "string" && /^[1-9][0-9]*$/.test(v) && v.length <= 39 && BigInt(v) < (1n << 128n);
export function withdrawalNear(value: string): string {
  if (value.length > 65 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,24})?$/.test(value)) throw Error("Nhập số NEAR dương, tối đa 24 chữ số sau dấu chấm.");
  const [whole, fraction = ""] = value.split("."); const amount = (BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, "0"))).toString();
  if (!positive(amount)) throw Error("Số rút phải dương và nằm trong u128."); return amount;
}
export function restoreWithdrawal(storage: StoragePort): WithdrawalAttempt | undefined {
  const raw = storage.getItem(withdrawalKey); if (raw === null) return;
  try { const a = JSON.parse(raw);
    if (!a || typeof a.owner !== "string" || a.owner.length < 2 || a.owner.length > 64 || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(a.owner) || !/^wd-[a-f0-9]{32}$/.test(a.withdrawalId) || !positive(a.amount) || !Number.isSafeInteger(a.beforeHeight) || a.beforeHeight < 0 || (a.hash !== undefined && !hashOk(a.hash)) || Object.keys(a).some(k => !["owner", "withdrawalId", "amount", "beforeHeight", "hash"].includes(k))) throw Error();
    return { owner: a.owner, withdrawalId: a.withdrawalId, amount: a.amount, beforeHeight: a.beforeHeight, ...(a.hash ? { hash: a.hash } : {}) };
  } catch { throw Error("Bản ghi rút tiền chưa đọc được. Giữ nguyên dữ liệu, chưa ký lại."); }
}
export function assertNoWithdrawal(storage: StoragePort) { if (storage.getItem(withdrawalKey) !== null) throw Error("Còn lần rút cần đối soát. Chưa ký giao dịch khác."); }
function save(storage: StoragePort, attempt: WithdrawalAttempt) { const raw = JSON.stringify(attempt); storage.setItem(withdrawalKey, raw); if (storage.getItem(withdrawalKey) !== raw) throw Error("Chưa lưu chắc chắn lần rút. Chưa mở ví."); return restoreWithdrawal(storage)!; }
export function beginWithdrawal(storage: StoragePort, owner: string, withdrawalId: string, amount: string, balance: Ledger, beforeHeight: number) {
  assertNoWithdrawal(storage);
  if (storage.getItem("near-owner-funding-attempt") !== null || storage.getItem("near-pending-request") !== null) throw Error("Đối soát funding/intent đang lưu trước khi rút.");
  if (!positive(amount) || BigInt(amount) > BigInt(available(balance))) throw Error("Số rút vượt principal khả dụng; không rút storage hoặc tiền đang giữ chỗ.");
  // Validate before persistence, including when this function is called outside the page.
  const attempt = { owner, withdrawalId, amount, beforeHeight };
  restoreWithdrawal({ ...storage, getItem: () => JSON.stringify(attempt) });
  return save(storage, attempt);
}
export function recordWithdrawalHash(storage: StoragePort, a: WithdrawalAttempt, hash: string) {
  if (!hashOk(hash) || JSON.stringify(restoreWithdrawal(storage)) !== JSON.stringify(a) || (a.hash && a.hash !== hash)) throw Error("Hash khác lần rút đã lưu.");
  return save(storage, { ...a, hash });
}
export function validateWithdrawalProposal(p: Proposal, owner: string, expected: { withdrawalId: string; amount: string }) {
  if (p.unsigned !== true || p.network !== "testnet" || p.signerId !== owner || p.transaction.receiverId !== CONTRACT || p.transaction.actions.length !== 1 || p.canonicalPolicy !== undefined) throw Error("Sai đề xuất rút tiền.");
  const a = p.transaction.actions[0]; const args = a.params.args;
  if (!positive(expected.amount) || a.type !== "FunctionCall" || a.params.methodName !== "withdraw" || a.params.gas !== "100000000000000" || a.params.deposit !== "0" || Object.keys(args).length !== 2 || args.withdrawal_id !== expected.withdrawalId || args.amount !== expected.amount) throw Error("Đề xuất rút khác số tiền hoặc mã đã xem lại.");
}
export function completeWithdrawal(storage: StoragePort, a: WithdrawalAttempt, result: any) {
  const matches = result?.events?.some((e: any) => e.event === "withdrawal_completed" && e.data?.some((d: any) => d.owner === a.owner && d.withdrawal_id === a.withdrawalId && d.withdrawal?.amount === a.amount && d.withdrawal.status === result.state));
  if (!a.hash || result.transactionHash !== a.hash || result.owner !== a.owner || result.withdrawalId !== a.withdrawalId || result.amount !== a.amount || result.finalized !== true || !["SETTLED", "FAILED"].includes(result.state) || !Number.isSafeInteger(result.executionBlockHeight) || result.executionBlockHeight <= a.beforeHeight || !matches || JSON.stringify(restoreWithdrawal(storage)) !== JSON.stringify(a)) throw Error("Chưa có kết quả FINAL đúng lần rút. Giữ nguyên, chưa ký lại.");
  storage.removeItem(withdrawalKey); if (storage.getItem(withdrawalKey) !== null) throw Error("Chưa hoàn tất ghi nhận lần rút.");
}
