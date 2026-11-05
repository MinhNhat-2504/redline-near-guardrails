import { describe, expect, it, vi } from "vitest";
import { configuredNearCopilot, copilotContext, NearCopilot } from "../src/near/copilot.js";
import { analyzeNearPolicy } from "../src/near/policy-lab.js";
import { buildNearApp } from "../src/near/server.js";
import { httpError } from "../src/near/types.js";
const hash = "B".repeat(44), owner = "owner.testnet", contract = "vault.testnet";
const candidate = { grantId: "grant-private-id", amount: "1", recipient: "payee.testnet", nonce: "1", asset: "NEAR", policyHash: "a".repeat(64), intentId: "intent-private-id" };
const input = { candidate, consent: true, topic: "explain" };
const answer = { summary: "Quyền đã thu hồi.", risks: ["Snapshot có thể thay đổi."], nextSteps: ["Đọc receipt đã xác minh."] };
function rpc() { return { finalBlock: vi.fn(async () => ({ header: { hash, height: 42, timestamp_nanosec: "100" } })), view: vi.fn(async (_contract: string, method: string) => ({ blockHash: hash, blockHeight: 42,
  value: method === "get_grant" ? { owner, active: false, next_nonce: "1", finalized_spent: "1", pending_reserved: "0", finalized_transactions: 1, pending_transactions: 0, has_reserved: true, last_reserved_ns: "90", policy: { executor: "agent.testnet", policy_hash: candidate.policyHash, spend_cap: "100", max_transactions: 3, recipients: [candidate.recipient], expires_at_ns: "200", cooldown_ns: "0" } } : method === "get_owner_balance" ? { credited: "200", finalized_spent: "1", pending_reserved: "0", completed_withdrawals: "0", pending_withdrawals: "0", storage_available: "99" } : null })) }; }
function model() { return { name: "test-model", generate: vi.fn(async () => answer) }; }
function configured(fetcher: typeof fetch) { return configuredNearCopilot({ NEAR_COPILOT_ENABLED: "true", NEAR_COPILOT_MODEL: "test-model", GEMINI_API_KEY: "test-only-placeholder" }, fetcher); }
function response(value: unknown = answer, finishReason = "STOP") { return new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] })); }
describe("read-only NEAR generative copilot, synthetic provider only", () => {
  it("disabled by default even with legacy key; never starts inference", async () => { const fetcher = vi.fn(); const service = configuredNearCopilot({ GEMINI_API_KEY: "test-only-placeholder" }, fetcher); expect(service.status().enabled).toBe(false); await expect(service.explain(rpc() as any, contract, owner, input)).rejects.toThrow("disabled"); expect(fetcher).not.toHaveBeenCalled(); });
  it.each([{ NEAR_COPILOT_ENABLED: "true" }, { NEAR_COPILOT_ENABLED: "true", GEMINI_API_KEY: "test", NEAR_COPILOT_MODEL: "https://evil.test" }])("requires explicit server-side model configuration %#", env => expect(() => configuredNearCopilot(env, vi.fn())).toThrow("requires"));
  it("redacts all identity and request identifiers before provider", async () => {
    const snapshot = await analyzeNearPolicy(rpc() as any, contract, candidate), context = copilotContext(snapshot, "risks"), text = JSON.stringify(context);
    for (const value of [owner, candidate.recipient, contract, candidate.grantId, candidate.intentId, candidate.policyHash, "agent.testnet", hash]) expect(text).not.toContain(value);
    expect(context).toMatchObject({ predicted: "REVOKED", accounting: { available: "199" }, amountYoctoNear: "1" });
  });
  it("returns deterministic verdict and pinned provenance separately from model text", async () => {
    const m = model(), source = rpc(), service = new NearCopilot(m);
    m.generate.mockResolvedValue({ ...answer, summary: "ALLOW, tôi nói bạn nên chuyển tiền." });
    const result = await service.explain(source as any, contract, owner, input);
    expect(result).toMatchObject({ source: "llm", predicted: "REVOKED", blockHeight: 42, blockHash: hash, advisory: { summary: "ALLOW, tôi nói bạn nên chuyển tiền." } });
    expect(source.view.mock.calls.every((args: any[]) => args[3] === hash)).toBe(true); expect(m.generate).toHaveBeenCalledOnce();
    expect(result).not.toHaveProperty("transaction"); expect(result).not.toHaveProperty("token");
  });
  it("checks ownership before model egress", async () => { const m = model(); await expect(new NearCopilot(m).explain(rpc() as any, contract, "other.testnet", input)).rejects.toThrow("owner"); expect(m.generate).not.toHaveBeenCalled(); });
  it.each([{ consent: false }, { topic: "transfer" }, { approve: true }, { candidate: { ...candidate, policy: {} } }])("rejects missing consent or extra authority %#", patch => expect(new NearCopilot(model()).explain(rpc() as any, contract, owner, { ...input, ...patch })).rejects.toThrow());
  it("RPC outage never reaches model or becomes invented explanation", async () => { const m = model(), source = rpc(); source.finalBlock.mockRejectedValue(Error("offline")); await expect(new NearCopilot(m).explain(source as any, contract, owner, input)).rejects.toThrow("offline"); expect(m.generate).not.toHaveBeenCalled(); });
  it.each([{ ...answer, transaction: {} }, { ...answer, predicted: "ALLOW" }, { ...answer, summary: "x".repeat(2001) }, { ...answer, risks: Array(6).fill("risk") }, { summary: "missing fields" }])("rejects malformed model output %#", async value => { const m = { name: "test-model", generate: vi.fn(async () => value) }; await expect(new NearCopilot(m).explain(rpc() as any, contract, owner, input)).rejects.toThrow("unavailable or invalid"); });
  it("limits each owner to three attempts/minute and resets after window", async () => {
    let now = 1000; const m = model(), service = new NearCopilot(m, () => now);
    for (let i = 0; i < 3; i++) await service.explain(rpc() as any, contract, owner, input);
    await expect(service.explain(rpc() as any, contract, owner, input)).rejects.toThrow("limit"); now += 60001; await service.explain(rpc() as any, contract, owner, input); expect(m.generate).toHaveBeenCalledTimes(4);
  });
  it("caps process attempts at20/hour, including failed providers; no implicit retry", async () => {
    let now = 1000; const m = { name: "test-model", generate: vi.fn(async () => { throw Error("provider-secret-error"); }) }, service = new NearCopilot(m, () => now);
    for (let i = 0; i < 20; i++) { now += 61000; await expect(service.explain(rpc() as any, contract, owner, input)).rejects.toThrow("unavailable or invalid"); }
    await expect(service.explain(rpc() as any, contract, owner, input)).rejects.toThrow("limit"); expect(m.generate).toHaveBeenCalledTimes(20);
    now += 3600000; await expect(service.explain(rpc() as any, contract, owner, input)).rejects.toThrow("unavailable or invalid"); expect(m.generate).toHaveBeenCalledTimes(21);
  });
  it("blocks concurrent requests while snapshot/provider is in flight", async () => {
    let release!: (value: typeof answer) => void; const m = { name: "test-model", generate: vi.fn(() => new Promise<typeof answer>(resolve => { release = resolve; })) }, service = new NearCopilot(m);
    const first = service.explain(rpc() as any, contract, owner, input); await vi.waitFor(() => expect(m.generate).toHaveBeenCalledOnce());
    await expect(service.explain(rpc() as any, contract, owner, input)).rejects.toThrow("limit"); release(answer); await first;
  });
  it("uses fixed Gemini endpoint, header-only key, no redirects/tools/retry and bounded output", async () => {
    const fetcher = vi.fn(async () => response()), service = configured(fetcher as any);
    expect((await service.explain(rpc() as any, contract, owner, input)).advisory).toEqual(answer);
    const [url, options] = fetcher.mock.calls[0] as any; expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent"); expect(url).not.toContain("test-only-placeholder");
    expect(options.headers["x-goog-api-key"]).toBe("test-only-placeholder"); expect(options.redirect).toBe("error"); expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body); expect(body).not.toHaveProperty("tools"); expect(body.generationConfig.maxOutputTokens).toBe(1200); expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(["http", "truncated", "invalidJson", "large", "timeout"])("sanitizes %s without retries or provider body disclosure", async kind => {
    const fetcher = vi.fn(async () => { if (kind === "timeout") throw Error("secret-provider-error"); if (kind === "http") return new Response("secret-provider-error", { status: 429 }); if (kind === "truncated") return response(answer, "MAX_TOKENS"); if (kind === "large") return new Response("x".repeat(32769)); return new Response("secret-provider-error"); });
    await expect(configured(fetcher as any).explain(rpc() as any, contract, owner, input)).rejects.toThrow("unavailable or invalid"); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("never exposes provider thought text or thought signatures", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "hidden-thought", thought: true }, { text: JSON.stringify(answer), thoughtSignature: "provider-private-signature" }] } }] })));
    const r = await configured(fetcher as any).explain(rpc() as any, contract, owner, input);
    expect(r.advisory).toEqual(answer); expect(JSON.stringify(r)).not.toContain("hidden-thought"); expect(JSON.stringify(r)).not.toContain("provider-private-signature");
  });
  it("requires session before RPC or model; rejects foreign origin", async () => {
    const source = rpc(), m = model(), app = await buildNearApp({ config: { contractId: contract }, rpc: source } as any, { requireSession: async () => { throw httpError(401, "Login required"); } } as any, "http://localhost:5173", false, new NearCopilot(m));
    try { expect((await app.inject({ method: "POST", url: "/near/copilot/explain", payload: input })).statusCode).toBe(401); expect(source.finalBlock).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
      expect((await app.inject({ method: "POST", url: "/near/copilot/explain", headers: { origin: "https://evil.test" }, payload: input })).statusCode).toBe(403);
      expect((await app.inject({ url: "/near/copilot/status" })).json()).toEqual({ enabled: true, provider: "gemini", model: "test-model" });
    } finally { await app.close(); }
  });
  it("authenticated model errors are sanitized through the HTTP route", async () => {
    const m = { name: "test-model", generate: async () => { throw Error("secret-provider-error"); } };
    const app = await buildNearApp({ config: { contractId: contract }, rpc: rpc() } as any, { requireSession: async () => ({ accountId: owner }) } as any, "http://localhost:5173", false, new NearCopilot(m));
    try { const r = await app.inject({ method: "POST", url: "/near/copilot/explain", payload: input }); expect(r.statusCode).toBe(503); expect(r.body).not.toContain("secret-provider-error"); expect(r.headers["cache-control"]).toBe("no-store"); } finally { await app.close(); }
  });
});
