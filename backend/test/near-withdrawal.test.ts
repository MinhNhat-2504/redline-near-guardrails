import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { observeWithdrawal, reconcileWithdrawal } from "../src/near/withdrawal.js";
import { buildNearApp } from "../src/near/server.js";
import { httpError } from "../src/near/types.js";
const VAULT = "nhat-redline-vault.testnet", OWNER = "nhat-redline-owner.testnet";
const fixture = () => JSON.parse(readFileSync(new URL("../../docs/evidence/phase2-withdraw.json", import.meta.url), "utf8")).result;
const expected = (tx: any) => ({ hash: tx.transaction.hash, ...(() => { const args = JSON.parse(Buffer.from(tx.transaction.actions[0].FunctionCall.args, "base64").toString()); return { withdrawalId: args.withdrawal_id, amount: args.amount }; })(), minBlockHeight: 9 });
function chainFor(tx = fixture()) {
  const e = expected(tx);
  return { config: { contractId: VAULT }, rpc: { transaction: vi.fn(async () => tx), blockAtHash: vi.fn(async (hash: string) => ({ header: { hash, height: 10 } })), view: vi.fn(async () => ({ value: { amount: e.amount, status: "SETTLED" }, blockHeight: 11, blockHash: "B".repeat(44) })) }, store: { track: vi.fn(), commit: vi.fn() } };
}
describe("withdrawal reconciliation, archived real CLI receipt and synthetic negative cases", () => {
  it("accepts archived real Phase2 withdrawal, not a new browser proof", () => { const tx = fixture(); expect(observeWithdrawal(tx, VAULT, OWNER, expected(tx))).toMatchObject({ finalized: true, state: "SETTLED" }); });
  it.each(["owner", "id", "amount", "gas", "deposit", "extraAction"])("rejects mismatched %s", kind => {
    const tx = fixture(), e = expected(tx); let owner = OWNER;
    if (kind === "owner") owner = "other.testnet"; if (kind === "id") e.withdrawalId = "different"; if (kind === "amount") e.amount = "1";
    if (kind === "gas") tx.transaction.actions[0].FunctionCall.gas = 80000000000000; if (kind === "deposit") tx.transaction.actions[0].FunctionCall.deposit = "1"; if (kind === "extraAction") tx.transaction.actions.push(tx.transaction.actions[0]);
    expect(() => observeWithdrawal(tx, VAULT, owner, e)).toThrow();
  });
  it("does not claim settlement when any receipt failed", () => { const tx = fixture(); tx.receipts_outcome[0].outcome.status = { Failure: { ActionError: {} } }; expect(observeWithdrawal(tx, VAULT, OWNER, expected(tx)).state).not.toBe("SETTLED"); });
  it("keeps optimistic responses unresolved and uncommitted", async () => { const tx = fixture(); tx.final_execution_status = "EXECUTED_OPTIMISTIC"; const chain = chainFor(tx); const r = await reconcileWithdrawal(chain as any, OWNER, expected(tx)); expect(r.finalized).toBe(false); expect(chain.store.commit).not.toHaveBeenCalled(); });
  it("requires newer execution and a matching finalized stored withdrawal", async () => {
    const chain = chainFor(), e = expected(fixture());
    await expect(reconcileWithdrawal(chain as any, OWNER, { ...e, minBlockHeight: 10 })).rejects.toThrow("predates"); expect(chain.store.commit).not.toHaveBeenCalled();
    expect(await reconcileWithdrawal(chain as any, OWNER, e)).toMatchObject({ state: "SETTLED", finalized: true, executionBlockHeight: 10, owner: OWNER, withdrawalId: e.withdrawalId, amount: e.amount }); expect(chain.store.commit).toHaveBeenCalledOnce();
  });
  it.each(["oldView", "amount", "status"])("does not commit a mismatched %s", kind => {
    const chain = chainFor(); chain.rpc.view.mockImplementation(async () => ({ value: { amount: kind === "amount" ? "1" : expected(fixture()).amount, status: kind === "status" ? "FAILED" : "SETTLED" }, blockHeight: kind === "oldView" ? 9 : 11, blockHash: "B".repeat(44) }));
    return expect(reconcileWithdrawal(chain as any, OWNER, expected(fixture()))).rejects.toThrow("does not match").then(() => expect(chain.store.commit).not.toHaveBeenCalled());
  });
  it("authenticates before any withdrawal RPC read", async () => {
    const chain = chainFor(), app = await buildNearApp(chain as any, { requireSession: async () => { throw httpError(401, "NEAR wallet session required"); } } as any, "http://localhost:5173", false);
    try { expect((await app.inject({ method: "POST", url: "/near/withdrawals/reconcile", payload: expected(fixture()) })).statusCode).toBe(401); expect(chain.rpc.transaction).not.toHaveBeenCalled(); } finally { await app.close(); }
  });
});
