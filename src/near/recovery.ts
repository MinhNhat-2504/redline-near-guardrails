import { restoreFunding } from "./funding";
import { restorePending } from "./pending";
import type { IntentRequest } from "./pending";

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function startupGrant(explicit: string | null, saved: { request?: IntentRequest; grantId?: string }): string {
  // A shared URL must not strand a durable intent behind a now-locked grant field.
  return saved.request?.grant_id ?? explicit ?? saved.grantId ?? "";
}
/** Independent local reads only. An unavailable API must not hide an outstanding wallet operation. */
export function recoverLocalState(storage: StoragePort) {
  let funding: ReturnType<typeof restoreFunding>, request: ReturnType<typeof restorePending>;
  const errors: string[] = [];
  try { funding = restoreFunding(storage); } catch { errors.push("Chưa đọc được funding đã lưu. Giữ nguyên dữ liệu, chưa ký lại."); }
  try { request = restorePending(storage); } catch { errors.push("Chưa đọc được intent đã lưu. Giữ nguyên dữ liệu, chưa tạo intent khác."); }
  return { funding, request, errors };
}
export function assertLocalRecovery(storage: StoragePort) {
  const saved = recoverLocalState(storage);
  if (saved.errors.length) throw Error(saved.errors.join(" "));
}
export function recoverStartup(getStorage: () => StoragePort) {
  try {
    const storage = getStorage(), saved = recoverLocalState(storage);
    let grantId = saved.request?.grant_id;
    if (!grantId) {
      try { const remembered = storage.getItem("near-grant"); if (remembered && /^[A-Za-z0-9_-]{1,64}$/.test(remembered)) grantId = remembered; }
      catch { /* Non-financial navigation metadata cannot erase a recovered operation. */ }
    }
    return { ...saved, grantId };
  } catch {
    return { funding: undefined, request: undefined, grantId: undefined, errors: ["Trình duyệt không cho đọc dữ liệu khôi phục. Chưa ký hoặc gửi giao dịch; không coi là trạng thái trống."] };
  }
}
