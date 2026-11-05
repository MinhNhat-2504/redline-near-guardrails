import { describe, expect, it, vi } from "vitest";
import { analyzeNearPolicy, evaluateNearPolicy, labInput } from "../src/near/policy-lab.js";
import { buildNearApp } from "../src/near/server.js";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
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
});
