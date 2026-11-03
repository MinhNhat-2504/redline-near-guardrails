import { z } from "zod";
import { decodeBase64Json } from "./receipts.js";

export class NearRpcError extends Error {
  constructor(readonly code: string) { super(`NEAR read-only RPC failed: ${code}`); }
}

/** Testnet-only, no key loading, no transaction broadcast API. */
export class NearReadOnlyRpc {
  private checked = false;
  private sequence = 0;
  constructor(
    private readonly url = "https://rpc.testnet.near.org",
    private readonly fetcher: typeof fetch = fetch,
    private readonly pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  ) {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("NEAR RPC requires HTTPS without embedded credentials");
  }

  async connect(): Promise<void> {
    this.checked = false;
    const status = z.object({ chain_id: z.literal("testnet"), sync_info: z.object({ syncing: z.literal(false) }) }).parse(await this.request("status", []));
    this.checked = status.chain_id === "testnet";
  }

  async transaction(hash: string, signer: string): Promise<unknown> {
    this.requireConnected();
    return this.request("tx", { tx_hash: hash, sender_account_id: signer, wait_until: "FINAL" });
  }

  async view(contract: string, method: string, args: Record<string, unknown>): Promise<unknown> {
    this.requireConnected();
    const result = z.object({ result: z.array(z.number().int().min(0).max(255)), block_height: z.number().int().nonnegative().safe(), block_hash: z.string() }).parse(await this.request("query", {
      request_type: "call_function", finality: "final", account_id: contract, method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    }));
    return { value: decodeBase64Json(Buffer.from(result.result).toString("base64")), blockHeight: result.block_height, blockHash: result.block_hash };
  }

  private requireConnected(): void { if (!this.checked) throw new Error("Verify Testnet RPC identity with connect() first"); }

  private async request(method: "status" | "tx" | "query", params: unknown): Promise<unknown> {
    const id = `redline-near-${++this.sequence}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      let reply: Response;
      try {
        reply = await this.fetcher(this.url, {
          method: "POST", headers: { "content-type": "application/json" }, redirect: "error",
          body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(15_000),
        });
      } catch {
        if (attempt === 2) throw new NearRpcError("TRANSPORT");
        await this.pause(250 * 2 ** attempt); continue;
      }
      if ((reply.status === 429 || reply.status >= 500) && attempt < 2) {
        await reply.body?.cancel();
        await this.pause(250 * 2 ** attempt); continue;
      }
      if (!reply.ok) throw new NearRpcError(`HTTP_${reply.status}`);
      const text = await reply.text();
      if (Buffer.byteLength(text) > 2_000_000) throw new NearRpcError("RESPONSE_TOO_LARGE");
      const body = z.object({ jsonrpc: z.literal("2.0"), id: z.string(), result: z.unknown().optional(), error: z.unknown().optional() }).parse(JSON.parse(text));
      if (body.id !== id) throw new NearRpcError("RESPONSE_ID_MISMATCH");
      if ("error" in body) throw new NearRpcError("REMOTE_ERROR");
      if (!("result" in body) || body.result === null || body.result === undefined) throw new NearRpcError("MISSING_RESULT");
      return body.result;
    }
    throw new NearRpcError("RETRY_EXHAUSTED");
  }
}
