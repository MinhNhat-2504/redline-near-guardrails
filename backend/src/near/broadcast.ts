/** A single attempt of the already-persisted packet. Caller resolves uncertainty by hash. */
export async function broadcastPrepared(url: string, signedBase64: string): Promise<void> {
  const response = await fetch(url, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "redline-prepared", method: "send_tx", params: { signed_tx_base64: signedBase64, wait_until: "INCLUDED" } }),
  });
  if (!response.ok) throw new Error("NEAR broadcast response unavailable");
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("NEAR broadcast response oversized");
  const body = JSON.parse(text);
  if (body.id !== "redline-prepared" || body.error || !body.result) throw new Error("NEAR broadcast outcome unknown");
}
