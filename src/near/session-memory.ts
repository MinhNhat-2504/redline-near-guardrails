export type SessionMemory = { token: string; revision: number };
/** Shared across old lazy-wallet and new API closures during Vite HMR, in this tab's RAM only. */
export function sessionMemory(hotData?: Record<string, unknown>): SessionMemory {
  const saved = hotData?.nearSessionMemory as SessionMemory | undefined;
  if (saved !== undefined) {
    if (!saved || typeof saved.token !== "string" || !Number.isSafeInteger(saved.revision) || saved.revision < 0) throw Error("Bộ nhớ phiên không hợp lệ. Tải lại trang và đăng nhập lại.");
    return saved;
  }
  const memory = { token: "", revision: 0 };
  if (hotData) hotData.nearSessionMemory = memory;
  return memory;
}
