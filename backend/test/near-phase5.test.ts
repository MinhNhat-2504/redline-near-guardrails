// Offline regressions over real saved RPC data and injected HTTP requests.
// Mutations below are synthetic adversarial inputs, never new on-chain proofs.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeVaultTransaction } from "../src/near/receipts.js";
import { observeFunding } from "../src/near/funding.js";
import { buildNearApp } from "../src/near/server.js";
import { httpError } from "../src/near/types.js";

const VAULT = "nhat-redline-vault.testnet", OWNER = "nhat-redline-web.testnet", AGENT = "nhat-redline-agent.testnet";
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/phase4-web-${name}-verification.json`, import.meta.url), "utf8"));
const allow = () => read("allow").transaction;
const reports = [read("allow"), ...read("rejections").evidence, ...read("owner-actions").evidence, read("storage"), read("principal")];

describe("Phase5 saved browser receipt regressions (offline)", () => {
  it.each(reports)("re-parses real FINAL transaction $hash", report => {
    const tx = report.transaction;
    const observed = observeVaultTransaction(tx, VAULT, tx.transaction.hash, tx.transaction.signer_id);
    expect(observed).toMatchObject({ finalized: true, state: report.observation.state });
    expect(observed.reason).toBe(report.observation.reason);
  });
  it.each(["storage", "principal"])("checks exact reviewed %s funding on saved real receipt", name => {
    const report = read(name);
    expect(observeFunding(report.transaction, VAULT, OWNER, { hash: report.hash, method: report.method, amount: report.amount, minBlockHeight: 0 })).toMatchObject({ finalized: true, state: "CONFIRMED" });
    expect(() => observeFunding(report.transaction, VAULT, "other-owner.testnet", { hash: report.hash, method: report.method, amount: report.amount, minBlockHeight: 0 })).toThrow("identity mismatch");
  });
  it.each(["INCLUDED", "INCLUDED_FINAL", "EXECUTED_OPTIMISTIC"])("never settles %s", status => {
    const tx = allow(); tx.final_execution_status = status;
    expect(observeVaultTransaction(tx, VAULT, tx.transaction.hash, AGENT)).toMatchObject({ finalized: false, state: "PENDING", events: [] });
  });
  it("ignores a terminal event moved to an untrusted emitter", () => {
    const tx = allow();
    for (const r of tx.receipts_outcome) if (r.outcome.logs.some((s: string) => s.includes('"event":"intent_completed"'))) r.outcome.executor_id = "evil.testnet";
    expect(observeVaultTransaction(tx, VAULT, tx.transaction.hash, AGENT).state).toBe("UNKNOWN");
  });
  it("cannot settle from a success return when any receipt failed", () => {
    const tx = allow(); tx.receipts_outcome[tx.receipts_outcome.length - 1].outcome.status = { Failure: { synthetic: true } };
    expect(observeVaultTransaction(tx, VAULT, tx.transaction.hash, AGENT).state).toBe("UNKNOWN");
  });
  it("rejects changed terminal amount and duplicate receipt identities", () => {
    const tx = allow();
    const value = JSON.parse(Buffer.from(tx.status.SuccessValue, "base64").toString()); value.amount = "1";
    tx.status.SuccessValue = Buffer.from(JSON.stringify(value)).toString("base64");
    expect(() => observeVaultTransaction(tx, VAULT, tx.transaction.hash, AGENT)).toThrow("does not match");
    const duplicate = allow(); duplicate.receipts_outcome.push(duplicate.receipts_outcome[0]);
    expect(() => observeVaultTransaction(duplicate, VAULT, duplicate.transaction.hash, AGENT)).toThrow("Duplicate receipt");
  });
});

describe("Phase5 HTTP authority boundaries (injected, no public RPC)", () => {
  const apps: Awaited<ReturnType<typeof buildNearApp>>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
  async function setup(account?: string) {
    const chain = { config: { contractId: VAULT, executorId: AGENT }, signingEnabled: false,
      readGrant: vi.fn(async () => ({ value: { owner: OWNER, policy: {} } })), executeTransfer: vi.fn(), track: vi.fn(),
      rpc: { transaction: vi.fn() }, store: { scope: `testnet:${VAULT}` }, db: { nearTransaction: { findMany: vi.fn() } } };
    const auth = { requireSession: vi.fn(async () => { if (!account) throw httpError(401, "NEAR wallet session required"); return { accountId: account }; }) };
    const app = await buildNearApp(chain as any, auth as any, "http://localhost:5173", false); apps.push(app);
    return { app, chain, auth };
  }
  it.each(["/near/owner-actions", "/near/owner-actions/reconcile", "/near/grants/g/intents", "/near/transactions/track"])("requires owner session before %s side effects", async url => {
    const { app, chain } = await setup();
    const response = await app.inject({ method: "POST", url, headers: { "x-redline-key": "not-owner-authority" }, payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(chain.executeTransfer).not.toHaveBeenCalled(); expect(chain.track).not.toHaveBeenCalled(); expect(chain.rpc.transaction).not.toHaveBeenCalled();
  });
  it("blocks foreign origins and oversized bodies before authentication", async () => {
    const { app, auth } = await setup(OWNER);
    expect((await app.inject({ method: "POST", url: "/near/owner-actions", headers: { origin: "https://evil.test" }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/near/owner-actions", payload: { padding: "x".repeat(32768) } })).statusCode).toBe(413);
    expect(auth.requireSession).not.toHaveBeenCalled();
  });
  it("another authenticated owner cannot read the journal or prepare revocation", async () => {
    const { app, chain } = await setup("other-owner.testnet");
    expect((await app.inject({ method: "GET", url: "/near/transactions?grantId=g" })).statusCode).toBe(403);
    expect(chain.db.nearTransaction.findMany).not.toHaveBeenCalled();
    expect((await app.inject({ method: "POST", url: "/near/owner-actions", payload: { method: "revoke_grant", grantId: "g" } })).statusCode).toBe(403);
  });
  it("does not reflect internal failures and marks successful snapshots non-cacheable", async () => {
    const { app, chain } = await setup();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.headers["cache-control"]).toBe("no-store"); expect(health.headers["x-content-type-options"]).toBe("nosniff");
    chain.readGrant.mockRejectedValueOnce(Error("synthetic-private-diagnostic"));
    const response = await app.inject({ method: "GET", url: "/near/grants/g" });
    expect(response.statusCode).toBe(503); expect(response.body).not.toContain("synthetic-private"); expect(response.headers["cache-control"]).toBe("no-store");
  });
});
