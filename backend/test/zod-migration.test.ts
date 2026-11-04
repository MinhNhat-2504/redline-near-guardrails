import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { migrationCorpus } from "../scripts/check-zod-migration.js";
import { readFileSync } from "node:fs";
import { amount, positiveAmount, uint64, policySchema, transferSchema } from "../src/near/types.js";
import { ownerActionSchema } from "../src/near/owner-actions.js";
import { reconcileFundingSchema } from "../src/near/funding.js";
import { buildNearApp } from "../src/near/server.js";

describe("approved Zod4 compatibility and denial-of-service regression (offline)", () => {
  const before = JSON.parse(readFileSync(new URL("../../docs/evidence/phase5-zod3-compat-before.json", import.meta.url), "utf8"));
  it.each(migrationCorpus())("preserves acceptance and valid output: $name", ({ name, schema, input }) => {
    const expected = before.cases.find((c: any) => c.name === name);
    expect(expected).toBeDefined();
    const parsed = schema.safeParse(input);
    expect(parsed.success).toBe(expected.accepted);
    if (parsed.success) expect(parsed.data).toEqual(expected.value);
  });
  it("rejects oversized constrained arrays before validating their elements", () => {
    let visited = 0;
    const item = z.string().transform(v => { visited++; return v; });
    const bounded = z.array(item).max(4);
    // Deliberately bounded local vector: catches eager allocation/element work,
    // without relying on timing, RSS thresholds or public endpoint load tests.
    const result = bounded.safeParse(Array(4096).fill("recipient.testnet"));
    expect(result.success).toBe(false); expect(visited).toBe(0);
    expect(bounded.parse(["one", "two"])).toEqual(["one", "two"]); expect(visited).toBe(2);
  });
  it("retains exact integer maxima and rejects invalid text without native exceptions", () => {
    expect(amount.parse(((1n << 128n) - 1n).toString())).toBe(((1n << 128n) - 1n).toString());
    expect(uint64.parse(((1n << 64n) - 1n).toString())).toBe(((1n << 64n) - 1n).toString());
    for (const v of ["bad", "01", "-1", "1e4", "", null, 1]) expect(positiveAmount.safeParse(v).success).toBe(false);
    for (const method of ["deposit", "storage_deposit", "withdraw"]) expect(ownerActionSchema.safeParse({ method, amount: "bad", ...(method === "withdraw" ? { withdrawalId: "w" } : {}) }).success).toBe(false);
    expect(reconcileFundingSchema.safeParse({ hash: "B".repeat(44), method: "deposit", amount: "bad", minBlockHeight: 1 }).success).toBe(false);
  });
  it("keeps policy allowlists strict and record values explicit", () => {
    const policy = { executor: "agent.testnet", policy_hash: "a".repeat(64), spend_cap: "1", max_transactions: 1, recipients: Array(4096).fill("payee.testnet"), expires_at_ns: "1", cooldown_ns: "0" };
    const invalid = policySchema.safeParse(policy); expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues.length).toBeLessThan(5);
    const record = z.record(z.string(), z.unknown()).default({});
    expect(record.parse(undefined)).toEqual({}); expect(record.parse({ nested: { n: 1 }, empty: null })).toEqual({ nested: { n: 1 }, empty: null });
    expect(record.safeParse([]).success).toBe(false);
  });
  it("maps malformed financial requests to400 before execution", async () => {
    const executeTransfer = vi.fn();
    const app = await buildNearApp({ config: { contractId: "vault.testnet", executorId: "agent.testnet" }, executeTransfer } as any,
      { requireSession: async () => ({ accountId: "owner.testnet" }) } as any, "http://localhost:5173", false);
    try {
      const payload = { grant_id: "g", intent_id: "i", nonce: "0", asset: "NEAR", recipient: "payee.testnet", amount: "bad", policy_hash: "a".repeat(64) };
      expect(transferSchema.safeParse(payload).success).toBe(false);
      const reply = await app.inject({ method: "POST", url: "/near/grants/g/intents", payload });
      expect(reply.statusCode).toBe(400); expect(reply.json()).toEqual({ error: "Invalid NEAR request or chain data" });
      expect(executeTransfer).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
