import { describe, expect, it, vi } from "vitest";
import { analyzeNearPolicy, evaluateNearPolicy, labInput } from "../src/near/policy-lab.js";
import { buildNearApp } from "../src/near/server.js";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { httpError } from "../src/near/types.js";
const hash = "B".repeat(44), policyHash = "a".repeat(64);
const g = { owner: "alice.testnet", active: true, next_nonce: "1", finalized_spent: "10", pending_reserved: "20", finalized_transactions: 1, pending_transactions: 1, has_reserved: true, last_reserved_ns: "90",
  policy: { executor: "agent.testnet", policy_hash: policyHash, spend_cap: "100", max_transactions: 3, recipients: ["payee.testnet"], expires_at_ns: "200", cooldown_ns: "10" } };
const b = { credited: "200", finalized_spent: "10", pending_reserved: "20", completed_withdrawals: "30", pending_withdrawals: "40", storage_available: "999" };
const r = { grantId: "grant-test", amount: "1", recipient: "payee.testnet", nonce: "1", asset: "NEAR", policyHash };
function rpcStub(patch: Record<string, unknown> = {}) {
  return { finalBlock: vi.fn(async () => ({ header: { hash, height: 42, timestamp_nanosec: "100" } })),
    view: vi.fn(async (_contract: string, method: string, _args: unknown, _blockHash: string) => ({ value: method === "get_grant" ? g : method === "get_owner_balance" ? b : null, blockHeight: 42, blockHash: hash, ...patch })) };
}
describe("NEAR Policy Lab prediction, not transaction proof", () => {
  it("allows equality at cooldown and remaining cap, includes pending reservations", () => {
    expect(evaluateNearPolicy(g, b, { ...r, amount: "70" }, "100", false).predicted).toBe("ALLOW");
    expect(evaluateNearPolicy(g, b, { ...r, amount: "71" }, "100", false).predicted).toBe("SPEND_CAP_EXCEEDED");
    expect(evaluateNearPolicy(g, { ...b, credited: "101" }, { ...r, amount: "2" }, "100", false).predicted).toBe("INSUFFICIENT_BALANCE");
  });
  it.each([
    ["REVOKED", { ...g, active: false }, r, "100", false],
    ["EXPIRED", g, r, "200", false],
    ["NONCE_REPLAY", g, { ...r, nonce: "0" }, "100", false],
    ["NONCE_REPLAY", g, r, "100", true],
    ["ASSET_NOT_ALLOWED", g, { ...r, asset: "USDC" }, "100", false],
    ["DESTINATION_NOT_ALLOWED", g, { ...r, recipient: g.owner }, "100", false],
    ["TX_CAP_EXCEEDED", { ...g, pending_transactions: 2 }, r, "100", false],
    ["COOLDOWN_ACTIVE", g, r, "99", false],
    ["COOLDOWN_ACTIVE", g, r, "80", false],
    ["POLICY_HASH_MISMATCH", g, { ...r, policyHash: "b".repeat(64) }, "100", false],
    ["INVALID_AMOUNT", g, { ...r, amount: "0" }, "100", false],
  ] as const)("predicts %s and stops later gates %#", (reason, grant, candidate, now, duplicate) => {
    const result = evaluateNearPolicy(grant, b, candidate, now, duplicate);
    expect(result.predicted).toBe(reason);
    const index = result.gates.findIndex(x => x.status === "BLOCK");
    expect(result.gates.slice(index + 1).every(x => x.status === "NOT_EVALUATED")).toBe(true);
  });
  it("preserves first failure order and u128 arithmetic without precision loss", () => {
    expect(evaluateNearPolicy({ ...g, active: false }, b, { ...r, nonce: "0" }, "201", true).predicted).toBe("REVOKED");
    expect(evaluateNearPolicy(g, b, { ...r, amount: ((1n << 128n) - 1n).toString() }, "100", false).predicted).toBe("SPEND_CAP_EXCEEDED");
  });
  it.each([{ amount: "1e3" }, { amount: "01" }, { amount: (1n << 128n).toString() }, { nonce: (1n << 64n).toString() }, { recipient: "<script>" }, { approve: true }])("rejects malformed candidate %#", patch => { expect(() => labInput.parse({ ...r, ...patch })).toThrow(); });
  it("pins grant/ledger/duplicate checks to the FINAL header, never mutates source", async () => {
    const rpc = rpcStub(), before = JSON.stringify({ g, b });
    const result = await analyzeNearPolicy(rpc as any, "vault.testnet", { ...r, intentId: "old" });
    expect(result).toMatchObject({ predicted: "ALLOW", blockHash: hash, blockHeight: 42, timestampNs: "100" });
    expect(rpc.view.mock.calls.every(call => call[3] === hash)).toBe(true);
    expect(rpc.view).toHaveBeenCalledWith("vault.testnet", "get_owner_balance", { owner: g.owner }, hash);
    expect(JSON.stringify({ g, b })).toBe(before);
  });
  it.each([{ blockHeight: 43 }, { blockHash: "C".repeat(44) }, { value: { ...g, pending_reserved: "101" } }])("fails closed on inconsistent snapshot %#", async patch => {
    await expect(analyzeNearPolicy(rpcStub(patch) as any, "vault.testnet", r)).rejects.toThrow();
  });
  it("unavailable data never becomes ALLOW", async () => {
    const rpc = rpcStub(); rpc.view.mockRejectedValueOnce(Error("offline"));
    await expect(analyzeNearPolicy(rpc as any, "vault.testnet", r)).rejects.toThrow("offline");
  });
  it("public read-only route accepts no policy override and calls no signing/DB interface", async () => {
    const rpc = rpcStub(), app = await buildNearApp({ config: { contractId: "vault.testnet" }, rpc } as any, {} as any, "http://localhost:5173", false);
    try {
      const response = await app.inject({ method: "POST", url: "/near/policy-lab/analyze", payload: r });
      expect(response.statusCode).toBe(200); expect(response.json().predicted).toBe("ALLOW"); expect(response.headers["cache-control"]).toBe("no-store");
      expect((await app.inject({ method: "POST", url: "/near/policy-lab/analyze", payload: { ...r, policy: { active: true } } })).statusCode).toBe(400);
    } finally { await app.close(); }
  });
  it("RPC pinned query uses block_id instead of finality and rejects a different response block", async () => {
    const fetcher = vi.fn(async (_url: any, options: any) => { const body = JSON.parse(options.body); return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: body.method === "status" ? { chain_id: "testnet", sync_info: { syncing: false } } : { block_height: 42, block_hash: "C".repeat(44), result: [110,117,108,108] } })); });
    const rpc = new NearReadOnlyRpc("https://rpc.test.invalid", fetcher as any);
    await rpc.connect(); await expect(rpc.view("vault.testnet", "get_grant", {}, hash)).rejects.toThrow("VIEW_BLOCK_MISMATCH");
    const params = JSON.parse(fetcher.mock.calls[1][1].body).params;
    expect(params.block_id).toBe(hash); expect(params.finality).toBeUndefined();
  });
  it("an ALLOW prediction never supplies authentication or authorizes a transfer", async () => {
    const rpc = rpcStub(), executeTransfer = vi.fn(), requireSession = vi.fn(async () => { throw httpError(401, "Wallet session required"); });
    const app = await buildNearApp({ config: { contractId: "vault.testnet" }, rpc, executeTransfer } as any, { requireSession } as any, "http://localhost:5173", false);
    try {
      const prediction = await app.inject({ method: "POST", url: "/near/policy-lab/analyze", payload: r });
      expect(prediction.json().predicted).toBe("ALLOW"); expect(prediction.json().token).toBeUndefined(); expect(requireSession).not.toHaveBeenCalled();
      const forged = await app.inject({ method: "POST", url: `/near/grants/${r.grantId}/intents`, payload: prediction.json() });
      expect(forged.statusCode).toBe(401); expect(executeTransfer).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("blocks foreign-origin, oversized, invalid and non-JSON analysis before RPC reads", async () => {
    const rpc = rpcStub(), app = await buildNearApp({ config: { contractId: "vault.testnet" }, rpc } as any, {} as any, "http://localhost:5173", false);
    try {
      expect((await app.inject({ method: "POST", url: "/near/policy-lab/analyze", headers: { origin: "https://evil.test" }, payload: r })).statusCode).toBe(403);
      expect((await app.inject({ method: "POST", url: "/near/policy-lab/analyze", payload: { ...r, padding: "x".repeat(32768) } })).statusCode).toBe(413);
      expect((await app.inject({ method: "POST", url: "/near/policy-lab/analyze", headers: { "content-type": "text/plain" }, payload: JSON.stringify(r) })).statusCode).toBe(415);
      expect((await app.inject({ method: "POST", url: "/near/policy-lab/analyze", payload: { ...r, owner: "foreign.testnet" } })).statusCode).toBe(400);
      expect(rpc.finalBlock).not.toHaveBeenCalled(); expect(rpc.view).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("local HTTP rate limit rejects analysis before any RPC request (no public load test)", async () => {
    const rpc = rpcStub(), app = await buildNearApp({ config: { contractId: "vault.testnet" }, rpc } as any, {} as any, "http://localhost:5173", false);
    try {
      for (let i = 0; i < 90; i++) expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
      expect((await app.inject({ method: "POST", url: "/near/policy-lab/analyze", payload: r })).statusCode).toBe(429);
      expect(rpc.finalBlock).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("an existing intent at the pinned block predicts replay without replacing it", async () => {
    const rpc = rpcStub(), original = rpc.view.getMockImplementation()!;
    rpc.view.mockImplementation(async (...args) => args[1] === "get_intent" ? { value: { status: "PENDING" }, blockHeight: 42, blockHash: hash } as any : original(...args));
    const result = await analyzeNearPolicy(rpc as any, "vault.testnet", { ...r, intentId: "existing" });
    expect(result.predicted).toBe("NONCE_REPLAY"); expect(result.grant).toEqual(g); expect(result.ledger).toEqual(b);
  });
});
