const base = import.meta.env.VITE_NEAR_API_URL || "http://127.0.0.1:8787";
// Bearer exists only in this tab's memory; never reuse CLI session files or wallet keys.
let token = "";
export function setToken(value: string) { token = value; }
export class NearApiError extends Error {
  constructor(readonly status: number) { super(`API ${status}. ${status === 401 ? "Phiên đăng nhập hết hạn. Đăng nhập ví lại, giữ nguyên request đã lưu." : "Giữ nguyên request; chưa suy luận giao dịch thành công."}`); }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(120_000), redirect: "error", credentials: "omit" });
  if (!response.ok) { if (response.status === 401) token = ""; throw new NearApiError(response.status); }
  return response.json() as Promise<T>;
}
