import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatNear, nanosecondsToSeconds, parseNear, secondsToNanoseconds, u64, U64_MAX, yocto, U128_MAX } from "../src/near/units.js";
import { observeVaultTransaction, type VaultObservation } from "../src/near/receipts.js";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { NearReceiptReader } from "../src/near/reader.js";

const VAULT = "nhat-redline-vault.testnet";
const AGENT = "nhat-redline-agent.testnet";
// Captured public Testnet receipts, not mocked transaction proofs.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/phase2-${name}.json`, import.meta.url), "utf8")).result;
const observe = (tx: ReturnType<typeof fixture>) => observeVaultTransaction(tx, VAULT, tx.transaction.hash, tx.transaction.signer_id);

describe("NEAR integer boundaries (T14)", () => {
  it.each(["0", "1", "0.05", "0.45", "9007199254.740993", "0.000000000000000000000001"])("round trips %s without JS-number conversion", value => {
    expect(formatNear(parseNear(value))).toBe(value);
  });
  it.each(["-1", "+1", "1e3", " 1", "1 ", "01", ".1", "1.", "NaN", "0.0000000000000000000000001"])("rejects ambiguous/rounded money %s", value => {
    expect(() => parseNear(value)).toThrow();
  });
  it("accepts integer maxima and refuses overflow and number inputs", () => {
    expect(yocto(U128_MAX.toString())).toBe(U128_MAX);
    expect(u64(U64_MAX.toString())).toBe(U64_MAX);
    expect(() => yocto((U128_MAX + 1n).toString())).toThrow();
    expect(() => u64((U64_MAX + 1n).toString())).toThrow();
    expect(() => yocto(50000000000000000000000)).toThrow();
    expect(() => parseNear("340282366920939")).toThrow();
  });
  it("retains sub-second remainder beyond Number.MAX_SAFE_INTEGER", () => {
    expect(nanosecondsToSeconds("1793681619385000000")).toEqual({ seconds: "1793681619", remainderNs: "385000000" });
    expect(secondsToNanoseconds("1793681619")).toBe("1793681619000000000");
    expect(() => secondsToNanoseconds(U64_MAX.toString())).toThrow();
  });
});

describe("NEAR receipt interpretation", () => {
  it.each([
    ["safe-transfer", "SETTLED", "OK"],
    ["cap-denial", "REJECTED", "SPEND_CAP_EXCEEDED"],
    ["recipient-denial", "REJECTED", "DESTINATION_NOT_ALLOWED"],
    ["post-revoke-denial", "REJECTED", "REVOKED"],
  ])("reads actual %s FINAL receipt and callback", (name, state, reason) => {
    expect(observe(fixture(name))).toMatchObject({ finalized: true, state, reason });
  });
  it("never settles optimistic data, even with a successful return value", () => {
    const tx = fixture("safe-transfer"); tx.final_execution_status = "EXECUTED_OPTIMISTIC";
    expect(observe(tx)).toMatchObject({ finalized: false, state: "PENDING", events: [] });
  });
  it("does not treat a missing transaction response as success", () => {
    expect(() => observeVaultTransaction(null, VAULT, "hash", AGENT)).toThrow();
  });
  it("requires transaction identity and refuses a wrong receiver or hash", () => {
    const tx = fixture("safe-transfer"); tx.transaction.receiver_id = AGENT;
    expect(() => observe(tx)).toThrow("identity");
    expect(() => observeVaultTransaction(fixture("safe-transfer"), VAULT, "another-hash", AGENT)).toThrow("identity");
  });
  it("ignores forged vault-looking events from another receipt executor", () => {
    const tx = fixture("safe-transfer");
    for (const receipt of tx.receipts_outcome) receipt.outcome.executor_id = AGENT;
    expect(observe(tx)).toMatchObject({ state: "UNKNOWN", events: [] });
  });
  it("does not trust success without the matching callback event", () => {
    const tx = fixture("safe-transfer");
    for (const receipt of tx.receipts_outcome) receipt.outcome.logs = [];
    expect(observe(tx).state).toBe("UNKNOWN");
  });
  it("discards events from a failed receipt and distinguishes runtime failure", () => {
    const tx = fixture("safe-transfer");
    for (const receipt of tx.receipts_outcome) receipt.outcome.status = { Failure: { ActionError: {} } };
    expect(observe(tx)).toMatchObject({ state: "UNKNOWN", events: [] });
    tx.status = { Failure: { ActionError: {} } };
    expect(observe(tx).state).toBe("RUNTIME_FAILED");
  });
  it("rejects mismatched callback amount and transaction amount", () => {
    const tx = fixture("safe-transfer");
    const args = JSON.parse(Buffer.from(tx.transaction.actions[0].FunctionCall.args, "base64").toString());
    args.amount = "1";
    tx.transaction.actions[0].FunctionCall.args = Buffer.from(JSON.stringify(args)).toString("base64");
    expect(() => observe(tx)).toThrow("arguments");
  });
  it("rejects duplicate receipt IDs and missing FINAL outcomes", () => {
    const tx = fixture("safe-transfer"); tx.receipts_outcome.push(tx.receipts_outcome[0]);
    expect(() => observe(tx)).toThrow("Duplicate receipt");
    tx.receipts_outcome = [];
    expect(() => observe(tx)).toThrow("no receipt");
  });
  it("distinguishes a confirmed owner action from a settled transfer", () => {
    expect(observe(fixture("revoke"))).toMatchObject({ state: "CONFIRMED", finalized: true });
    const tx = fixture("revoke"); tx.transaction.actions[0].FunctionCall.method_name = "unsupported";
    expect(observe(tx).state).toBe("UNKNOWN");
  });
  it("keeps a real transfer failure distinct from a runtime failure (synthetic fixture mutation)", () => {
    const tx = fixture("safe-transfer");
    const terminal = JSON.parse(Buffer.from(tx.status.SuccessValue, "base64").toString());
    terminal.status = "FAILED"; terminal.reason = "TRANSFER_FAILED";
    tx.status.SuccessValue = Buffer.from(JSON.stringify(terminal)).toString("base64");
    for (const r of tx.receipts_outcome) {
      if (r.outcome.executor_id === "nhat-redline-payee.testnet") r.outcome.status = { Failure: { ActionError: {} } };
      r.outcome.logs = r.outcome.logs.map((log: string) => {
        if (!log.startsWith("EVENT_JSON:")) return log;
        const event = JSON.parse(log.slice(11));
        if (event.event === "intent_completed") event.data[0].intent = terminal;
        return "EVENT_JSON:" + JSON.stringify(event);
      });
    }
    expect(observe(tx)).toMatchObject({ state: "FAILED", reason: "TRANSFER_FAILED" });
  });
  it("refuses unresolved receipt statuses even under a purported FINAL response", () => {
    const tx = fixture("safe-transfer"); tx.receipts_outcome[0].outcome.status = "Unknown";
    expect(() => observe(tx)).toThrow("Unresolved receipt");
  });
});

describe("read-only RPC safety", () => {
  function mockRpc(handler: (body: { id: string; method: string; params: Record<string, unknown> }) => Response) {
    return vi.fn(async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => handler(JSON.parse(String(init?.body)))) as unknown as typeof fetch;
  }
  const json = (id: string, result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
  it("requires network verification and rejects a mainnet endpoint response", async () => {
    const rpc = new NearReadOnlyRpc(undefined, mockRpc(b => json(b.id, { chain_id: "mainnet", sync_info: { syncing: false } })));
    await expect(rpc.transaction("hash", AGENT)).rejects.toThrow("connect()");
    await expect(rpc.connect()).rejects.toThrow();
    await expect(rpc.transaction("hash", AGENT)).rejects.toThrow("connect()");
    expect(() => new NearReadOnlyRpc("http://rpc.testnet.near.org")).toThrow("HTTPS");
    expect(() => new NearReadOnlyRpc("https://user:password@example.org")).toThrow("credentials");
  });
  it("requests FINAL transaction status and finalized views without sending transactions", async () => {
    const calls: string[] = [];
    const rpc = new NearReadOnlyRpc(undefined, mockRpc(b => {
      calls.push(b.method);
      if (b.method === "status") return json(b.id, { chain_id: "testnet", sync_info: { syncing: false } });
      if (b.method === "tx") {
        expect(b.params).toEqual({ tx_hash: "hash", sender_account_id: AGENT, wait_until: "FINAL" });
        return json(b.id, fixture("safe-transfer"));
      }
      expect(b.params.finality).toBe("final");
      return json(b.id, fixture("final-owner"));
    }));
    await rpc.connect(); await rpc.transaction("hash", AGENT);
    expect(await rpc.view(VAULT, "get_owner_balance", { owner: AGENT })).toMatchObject({ value: { completed_withdrawals: "450000000000000000000000" } });
    expect(calls).toEqual(["status", "tx", "query"]);
  });
  it("bounds retries on rate limits without ever broadcasting", async () => {
    let calls = 0; const delays: number[] = [];
    const rpc = new NearReadOnlyRpc(undefined, mockRpc(b => ++calls < 3 ? new Response("", { status: 429 }) : json(b.id, { chain_id: "testnet", sync_info: { syncing: false } })), async ms => { delays.push(ms); });
    await rpc.connect(); expect(calls).toBe(3); expect(delays).toEqual([250, 500]);
    const broken = new NearReadOnlyRpc(undefined, mockRpc(() => new Response("", { status: 503 })), async () => {});
    await expect(broken.connect()).rejects.toThrow("HTTP_503");
  });
  it("refuses missing, remote-error and mismatched-id responses", async () => {
    for (const response of [
      { jsonrpc: "2.0", id: "wrong", result: {} },
      { jsonrpc: "2.0", error: { message: "unknown transaction" } },
      { jsonrpc: "2.0", result: null },
    ]) {
      const rpc = new NearReadOnlyRpc(undefined, mockRpc(b => Response.json({ id: b.id, ...response })));
      await expect(rpc.connect()).rejects.toThrow();
    }
  });
});

describe("tracked receipt journal reconciliation (not a Postgres integration test)", () => {
  it("dedupes after reader restart using the same checkpoint store", async () => {
    const tx = fixture("safe-transfer"); const records = new Map<string, VaultObservation>();
    const store = { has: async (hash: string) => records.has(hash), commit: async (hash: string, value: VaultObservation) => { records.set(hash, value); } };
    const rpc = { transaction: vi.fn(async () => tx) }; const entry = { hash: tx.transaction.hash, signer: AGENT };
    const first = await new NearReceiptReader(VAULT, rpc, store).reconcile(entry);
    expect(first?.state).toBe("SETTLED");
    expect(await new NearReceiptReader(VAULT, rpc, store).reconcile(entry)).toBeNull();
    expect(rpc.transaction).toHaveBeenCalledTimes(1);
    expect(new Set(first!.events.map(e => e.id)).size).toBe(first!.events.length);
  });
  it("does not checkpoint PENDING or uncorroborated FINAL data", async () => {
    const tx = fixture("safe-transfer"); tx.final_execution_status = "INCLUDED_FINAL";
    const store = { has: async () => false, commit: vi.fn(async () => {}) };
    const reader = new NearReceiptReader(VAULT, { transaction: async () => tx }, store);
    const entry = { hash: tx.transaction.hash, signer: AGENT };
    await reader.reconcile(entry);
    tx.final_execution_status = "FINAL"; tx.receipts_outcome.forEach((r: { outcome: { logs: string[] } }) => { r.outcome.logs = []; });
    await reader.reconcile(entry); expect(store.commit).not.toHaveBeenCalled();
  });
  it("keeps failed persistence retryable rather than inventing a checkpoint", async () => {
    const tx = fixture("cap-denial"); const commit = vi.fn(async () => { throw new Error("store unavailable"); });
    const reader = new NearReceiptReader(VAULT, { transaction: async () => tx }, { has: async () => false, commit });
    const entry = { hash: tx.transaction.hash, signer: AGENT };
    await expect(reader.reconcile(entry)).rejects.toThrow("store unavailable");
    await expect(reader.reconcile(entry)).rejects.toThrow("store unavailable");
    expect(commit).toHaveBeenCalledTimes(2);
  });
});

describe("chain startup fails closed", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it.each(["near", "mainnet", "NEAR", "typo"])("never silently starts MockChain for CHAIN=%s", async kind => {
    vi.stubEnv("CHAIN", kind); vi.resetModules();
    const { initChain } = await import("../src/chain/index.js");
    await expect(initChain()).rejects.toThrow(kind === "near" ? "not enabled" : "Unsupported CHAIN");
  });
  it("preserves explicit mock operation", async () => {
    vi.stubEnv("CHAIN", "mock"); vi.resetModules();
    const { initChain } = await import("../src/chain/index.js");
    expect((await initChain()).kind).toBe("mock");
    vi.stubEnv("CHAIN", "solana");
    await expect(initChain()).rejects.toThrow("changed after startup");
  });
});
