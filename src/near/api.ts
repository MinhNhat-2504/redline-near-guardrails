const base = import.meta.env.VITE_NEAR_API_URL || "http://127.0.0.1:8787";
import { copilotErrorMessage, copilotRetrySeconds } from "./copilot-errors";
import { sessionMemory } from "./session-memory";
// Bearer exists only in this tab's memory; never reuse CLI session files or wallet keys.
const memory = sessionMemory(import.meta.hot?.data);
export function setToken(value: string) { memory.token = value; memory.revision++; }
export class NearApiError extends Error {
  constructor(readonly status: number, readonly code?: string, readonly staleSession = false, readonly retryAfterSeconds?: number) { super(copilotErrorMessage(code) ? `${code}: ${copilotErrorMessage(code)}` : `API ${status}. ${status === 401 ? staleSession ? "Yêu cầu thuộc phiên cũ đã bị từ chối. Phiên đăng nhập mới được giữ nguyên." : "Phiên đăng nhập không còn hợp lệ. Đăng nhập ví lại, giữ nguyên request đã lưu." : "Giữ nguyên request; chưa suy luận giao dịch thành công."}`); }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { token, revision } = memory;
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(120_000), redirect: "error", credentials: "omit" });
  if (!response.ok) {
    const staleSession = response.status === 401 && memory.revision !== revision;
    if (response.status === 401 && !staleSession) setToken("");
    let code: string | undefined;
    let retryAfterSeconds: number | undefined;
    if (path === "/near/copilot/explain" && response.status === 429) { code = "COPILOT_REQUEST_LIMIT"; retryAfterSeconds = 60; }
    if (path === "/near/copilot/explain" && response.status === 503) {
      try { const value = await response.json(); if (copilotErrorMessage(value?.code)) { code = value.code; retryAfterSeconds = copilotRetrySeconds(value.retryAfterSeconds); } } catch { /* No raw provider/server error is displayed. */ }
    }
    throw new NearApiError(response.status, code, staleSession, retryAfterSeconds);
  }
  return response.json() as Promise<T>;
}
export async function confirmSession(account: string): Promise<void> {
  if (!memory.token) throw Error("Ví đã trả kết quả nhưng API trong trang chưa nhận được phiên. Tải lại trang để đồng bộ module rồi đăng nhập lại.");
  const result = await api<{ accountId: string; expiresAt: string }>("/near/auth/me");
  if (result.accountId !== account || typeof result.expiresAt !== "string" || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) {
    setToken(""); throw Error("API chưa xác nhận đúng tài khoản và hạn phiên. Chưa coi là đã đăng nhập.");
  }
}
