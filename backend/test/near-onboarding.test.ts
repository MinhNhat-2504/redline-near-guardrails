import { describe, expect, it, vi } from "vitest";
import { accountSnapshot } from "../src/near/account.js";
import { buildNearApp } from "../src/near/server.js";
import { httpError } from "../src/near/types.js";
const owner = "web.testnet", hash = "B".repeat(44);
const raw = { amount: "2350000000000000000000000", locked: "0", storage_usage: 182, block_height: 42, block_hash: hash };
describe("newcomer account reads and owner-only history", () => {
  it("keeps native account amount as exact strings, separate from vault ledger", async () => {
    const account = vi.fn(async () => raw);
    expect(await accountSnapshot({ account } as any, owner)).toEqual({ network: "testnet", accountId: owner, amount: raw.amount, locked: "0", storageUsage: 182, blockHeight: 42, blockHash: hash });
    expect(account).toHaveBeenCalledWith(owner);
  });
  it.each([{ amount: 2350000000000000000000000 }, { amount: "-1" }, { locked: "bad" }, { block_height: Number.MAX_SAFE_INTEGER + 1 }, { block_hash: "bad" }])("refuses malformed account input %#", async patch => {
    await expect(accountSnapshot({ account: async () => ({ ...raw, ...patch }) } as any, owner)).rejects.toThrow();
  });
  it("never turns unavailable native balance into zero", async () => {
    await expect(accountSnapshot({ account: async () => { throw Error("RPC unavailable"); } } as any, owner)).rejects.toThrow("RPC unavailable");
  });
  it("reads account data without financial calls; history requires session", async () => {
    const findMany = vi.fn(async () => []), account = vi.fn(async () => raw);
    let authenticated = false;
    const chain = { config: { contractId: "vault.testnet" }, rpc: { account }, store: { scope: "testnet:vault.testnet" }, db: { nearTransaction: { findMany } } };
    const auth = { requireSession: async () => { if (!authenticated) throw httpError(401, "Login required"); return { accountId: owner }; } };
    const app = await buildNearApp(chain as any, auth as any, "http://localhost:5173", false);
    try {
      const response = await app.inject({ method: "GET", url: `/near/accounts/${owner}` });
      expect(response.statusCode).toBe(200); expect(response.json().amount).toBe(raw.amount); expect(response.headers["cache-control"]).toBe("no-store");
      expect((await app.inject({ method: "GET", url: "/near/owner-transactions" })).statusCode).toBe(401); expect(findMany).not.toHaveBeenCalled();
      authenticated = true;
      expect((await app.inject({ method: "GET", url: "/near/owner-transactions?ownerId=foreign.testnet" })).statusCode).toBe(200);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { scope: "testnet:vault.testnet", signerId: owner }, take: 100 }));
      expect(findMany.mock.calls[0][0]).toEqual(expect.objectContaining({ select: expect.not.objectContaining({ signedBase64: true }) }));
    } finally { await app.close(); }
  });
});
