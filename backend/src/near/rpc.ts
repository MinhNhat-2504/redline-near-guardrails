import { z } from "zod";
import { decodeBase64Json } from "./receipts.js";
import { networkBudget, retryAfterMs, type RpcBudget } from "./rpc-budget.js";

export const DEFAULT_NEAR_RPC = "https://test.rpc.fastnear.com";

export class NearRpcError extends Error {
  constructor(readonly code: string, readonly remoteName?: string) { super(`NEAR read-only RPC failed: ${code}`); }
}

/** Node's source-aware reviver retains an RPC u64 nonce before Number rounding. */
export function parseRpcJson(text: string): unknown {
  const parse = JSON.parse as (text: string, reviver: (key: string, value: unknown, context?: { source: string }) => unknown) => unknown;
  return parse(text, (key, value, context) => {
    if (key !== "nonce" || typeof value !== "number") return value;
    if (context && /^(0|[1-9][0-9]*)$/.test(context.source)) return context.source;
    if (Number.isSafeInteger(value) && value >= 0) return String(value);
    throw new NearRpcError("UNSAFE_NONCE_JSON");
  });
}

/** Testnet-only, no key loading, no transaction broadcast API. */
export class NearReadOnlyRpc {
  private checked = false;
  private sequence = 0;
  constructor(
    private readonly url = DEFAULT_NEAR_RPC,
    private readonly fetcher: typeof fetch = fetch,
    private readonly pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
    private readonly budget: RpcBudget | undefined = networkBudget(url, fetcher),
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

  async accessKey(account: string, publicKey: string): Promise<unknown> {
    this.requireConnected();
    return this.request("query", { request_type: "view_access_key", finality: "final", account_id: account, public_key: publicKey });
  }

  async finalBlock(height?: number): Promise<unknown> {
    this.requireConnected();
    return this.request("block", height === undefined ? { finality: "final" } : { block_id: height });
  }

  async chunk(hash: string): Promise<unknown> {
    this.requireConnected();
    return this.request("chunk", { chunk_id: hash });
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

  private async request(method: "status" | "tx" | "query" | "block" | "chunk", params: unknown): Promise<unknown> {
    const id = `redline-near-${++this.sequence}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.budget?.beforeRequest();
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
      if (reply.status === 429) {
        this.budget?.coolDown(retryAfterMs(reply.headers.get("retry-after")));
        await reply.body?.cancel();
        throw new NearRpcError("RATE_LIMITED"); // never hammer the same window with immediate retries
      }
      if (reply.status >= 500 && attempt < 2) {
        await reply.body?.cancel();
        await this.pause(250 * 2 ** attempt); continue;
      }
      if (!reply.ok) throw new NearRpcError(`HTTP_${reply.status}`);
      const text = await reply.text();
      if (Buffer.byteLength(text) > 2_000_000) throw new NearRpcError("RESPONSE_TOO_LARGE");
      const body = z.object({ jsonrpc: z.literal("2.0"), id: z.string(), result: z.unknown().optional(), error: z.unknown().optional() }).parse(parseRpcJson(text));
      if (body.id !== id) throw new NearRpcError("RESPONSE_ID_MISMATCH");
      if ("error" in body) {
        const error = z.object({ cause: z.object({ name: z.string() }).optional() }).safeParse(body.error);
        throw new NearRpcError("REMOTE_ERROR", error.success ? error.data.cause?.name : undefined);
      }
      if (!("result" in body) || body.result === null || body.result === undefined) throw new NearRpcError("MISSING_RESULT");
      return body.result;
    }
    throw new NearRpcError("RETRY_EXHAUSTED");
  }
}
