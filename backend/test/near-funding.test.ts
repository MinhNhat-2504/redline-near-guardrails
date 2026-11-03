import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fundingStatus, observeFunding, reconcileFunding } from "../src/near/funding.js";
import { NearReadOnlyRpc, NearRpcError } from "../src/near/rpc.js";
import { buildNearApp } from "../src/near/server.js";
import { httpError } from "../src/near/types.js";
const VAULT = "nhat-redline-vault.testnet", OWNER = "nhat-redline-owner.testnet";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/phase2-${name}.json`, import.meta.url), "utf8")).result;
const expected = (tx: any) => ({ hash: tx.transaction.hash, method: tx.transaction.actions[0].FunctionCall.method_name, amount: tx.transaction.actions[0].FunctionCall.deposit, minBlockHeight: 1 });
function rpcWith(error: string) {
  const fetcher = vi.fn(async (_url: unknown, init: any) => { const q = JSON.parse(init.body); return new Response(JSON.stringify({ jsonrpc: "2.0", id: q.id, result: q.method === "status" ? { chain_id: "testnet", sync_info: { syncing: false } } : { error, logs: [], block_height: 100, block_hash: "B".repeat(44) } })); });
  return new NearReadOnlyRpc("https://example.test", fetcher as typeof fetch);
}
describe("funding registration and exact public receipt verification", () => {
  it("recognizes only the explicit unregistered-owner panic, without inventing a zero ledger", async () => {
    const rpc = rpcWith('wasm execution failed: HostError(GuestPanic { panic_msg: "STORAGE_REGISTRATION_REQUIRED" })'); await rpc.connect();
    expect(await fundingStatus(rpc, VAULT, OWNER)).toEqual({ registered: false, blockHeight: 100, blockHash: "B".repeat(44) });
    const escaped = rpcWith('wasm execution failed: HostError(GuestPanic { panic_msg: "panicked at src/lib.rs:443:14:' + String.fromCharCode(92, 110) + 'STORAGE_REGISTRATION_REQUIRED" })'); await escaped.connect();
    expect(await fundingStatus(escaped, VAULT, OWNER)).toMatchObject({ registered: false });
  });
  it("unknown view errors and transport failures are never registered=false", async () => {
    const rpc = rpcWith("wasm execution failed: GuestPanic OTHER_FAILURE"); await rpc.connect();
    await expect(fundingStatus(rpc, VAULT, OWNER)).rejects.toThrow();
    await expect(fundingStatus({ view: async () => { throw new NearRpcError("RATE_LIMITED"); } } as any, VAULT, OWNER)).rejects.toThrow("RATE_LIMITED");
  });
  it.each(["owner-storage", "owner-deposit"])("accepts saved REAL Phase2 %s receipt, not a new browser proof", name => {
    const tx = fixture(name); expect(observeFunding(tx, VAULT, OWNER, expected(tx))).toMatchObject({ finalized: true, state: "CONFIRMED" });
  });
  it.each(["amount", "method", "owner", "extraAction", "args", "gas"])("rejects mismatched funding %s", kind => {
    const tx = fixture("owner-deposit"), match = expected(tx); let owner = OWNER;
    if (kind === "amount") match.amount = "1";
    if (kind === "method") match.method = "storage_deposit";
    if (kind === "owner") owner = "different.testnet";
    if (kind === "extraAction") tx.transaction.actions.push(tx.transaction.actions[0]);
    if (kind === "args") tx.transaction.actions[0].FunctionCall.args = Buffer.from('{"unexpected":1}').toString("base64");
    if (kind === "gas") tx.transaction.actions[0].FunctionCall.gas = 80000000000000;
    expect(() => observeFunding(tx, VAULT, owner, match)).toThrow();
  });
  it("keeps an optimistic funding response unresolved", () => { const tx = fixture("owner-deposit"); tx.final_execution_status = "EXECUTED_OPTIMISTIC"; expect(observeFunding(tx, VAULT, OWNER, expected(tx)).finalized).toBe(false); });
  it("does not accept an old confirmed transaction to clear a new ambiguous wallet attempt", async () => {
    const tx = fixture("owner-storage"), store = { track: vi.fn(), commit: vi.fn() };
    const chain = { config: { contractId: VAULT }, rpc: { transaction: async () => tx, blockAtHash: async (hash: string) => ({ header: { hash, height: 10 } }) }, store };
    await expect(reconcileFunding(chain as any, OWNER, { ...expected(tx), minBlockHeight: 10 })).rejects.toThrow("predates");
    expect(store.commit).not.toHaveBeenCalled();
    expect(await reconcileFunding(chain as any, OWNER, { ...expected(tx), minBlockHeight: 9 })).toMatchObject({ finalized: true, state: "CONFIRMED", executionBlockHeight: 10 });
    expect(store.commit).toHaveBeenCalledOnce();
  });
  it("requires an authenticated owner before looking up reconciliation", async () => {
    const transaction = vi.fn(); const auth = { requireSession: async () => { throw httpError(401, "NEAR wallet session required"); } };
    const app = await buildNearApp({ config: { contractId: VAULT }, rpc: { transaction } } as any, auth as any, "http://localhost:5173", false);
    try { const response = await app.inject({ method: "POST", url: "/near/owner-actions/reconcile", payload: { ...expected(fixture("owner-storage")) } }); expect(response.statusCode).toBe(401); expect(transaction).not.toHaveBeenCalled(); } finally { await app.close(); }
  });
});
