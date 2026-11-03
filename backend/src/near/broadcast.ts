import { networkBudget, retryAfterMs } from "./rpc-budget.js";
/** Public categorical diagnostics only: never expose the packet or raw RPC errors. */
export class NearBroadcastError extends Error {
  constructor(readonly code: string) { super(`NEAR submission unavailable: ${code}`); }
}
/** A single attempt of the already-persisted packet. Caller resolves uncertainty by hash. */
export async function broadcastPrepared(url: string, signedBase64: string): Promise<void> {
  const budget = networkBudget(url, fetch);
  await budget?.beforeRequest();
  let response: Response;
  try { response = await fetch(url, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "redline-prepared", method: "send_tx", params: { signed_tx_base64: signedBase64, wait_until: "INCLUDED" } }),
  }); } catch { throw new NearBroadcastError("TRANSPORT_OR_TIMEOUT"); }
  if (response.status === 429) budget?.coolDown(retryAfterMs(response.headers.get("retry-after")));
  if (!response.ok) { await response.body?.cancel(); throw new NearBroadcastError(`HTTP_${response.status}`); }
  let body;
  try {
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error();
    body = JSON.parse(text);
  } catch { throw new NearBroadcastError("INVALID_RESPONSE"); }
  if (body?.id !== "redline-prepared") throw new NearBroadcastError("RESPONSE_ID_MISMATCH");
  if (body.error) {
    const name = body.error?.cause?.name;
    const allowed = ["INVALID_TRANSACTION", "TIMEOUT_ERROR", "REQUEST_ROUTED", "DOES_NOT_TRACK_SHARD", "REQUEST_VALIDATION_ERROR", "INTERNAL_ERROR"];
    const code = body.error.code === -32601 ? "METHOD_NOT_FOUND" : allowed.includes(name) ? name : "RPC_REJECTED";
    throw new NearBroadcastError(code);
  }
  if (!body.result) throw new NearBroadcastError("MISSING_RESULT");
}
