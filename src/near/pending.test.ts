import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertRequestBinding, canComplete, completePending, parsePending, persistPending, restorePending, type IntentRequest, type JournalRow } from "./pending";
import type { Grant } from "./model";

const request: IntentRequest = { grant_id: "grant-test", intent_id: "intent-test", nonce: "0", asset: "NEAR", recipient: "payee.testnet", amount: "10000000000000000000000", policy_hash: "a".repeat(64) };
function storage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}
function row(state = "SETTLED"): JournalRow {
  return { hash: "tx", grantId: request.grant_id, intentId: request.intent_id, state, observation: JSON.stringify({ transactionHash: "tx", finalized: true, state, events: [{ event: state === "REJECTED" ? "intent_rejected" : "intent_completed", data: [{ grant_id: request.grant_id, intent_id: request.intent_id, intent: { nonce: request.nonce, amount: request.amount, recipient: request.recipient, status: state } }] }] }) };
}
describe("durable browser intent boundaries (no signing or network)", () => {
  it("restores the exact request and refuses to replace it", () => {
    const s = storage(); expect(persistPending(s, request)).toEqual(request); expect(restorePending(s)).toEqual(request);
    expect(() => persistPending(s, { ...request, intent_id: "replacement" })).toThrow(); expect(restorePending(s)).toEqual(request);
  });
  it("fails before returning a submit-ready request when storage throws or drops writes", () => {
    expect(() => persistPending({ ...storage(), setItem: () => { throw Error("QuotaExceededError"); } }, request)).toThrow("Quota");
    expect(() => persistPending({ ...storage(), setItem: () => {} }, request)).toThrow("lưu");
  });
  it("retains corrupted stored data for reconciliation instead of replacing it", () => {
    const s = storage(); s.setItem("near-pending-request", "{broken");
    expect(() => restorePending(s)).toThrow(); expect(() => persistPending(s, request)).toThrow(); expect(s.getItem("near-pending-request")).toBe("{broken");
  });
  it.each([{ nonce: "18446744073709551616" }, { nonce: 0 }, { amount: "340282366920938463463374607431768211456" }, { amount: "0" }, { amount: "1e22" }, { asset: "USDC" }, { recipient: "Bad Account" }, { surprise: "extra" }, { policy_hash: "bad" }])("rejects malformed persisted request: %j", patch => {
    expect(() => parsePending({ ...request, ...patch })).toThrow();
  });
  it("checks the loaded owner, grant and policy before submission", () => {
    const grant = { owner: "alice.testnet", policy: { policy_hash: request.policy_hash } } as Grant;
    expect(() => assertRequestBinding(request, request.grant_id, "alice.testnet", grant)).not.toThrow();
    expect(() => assertRequestBinding(request, "other-grant", "alice.testnet", grant)).toThrow();
    expect(() => assertRequestBinding(request, request.grant_id, "mallory.testnet", grant)).toThrow();
    expect(() => assertRequestBinding({ ...request, policy_hash: "b".repeat(64) }, request.grant_id, "alice.testnet", grant)).toThrow();
  });
  it.each(["SETTLED", "REJECTED", "FAILED"])("only completes the matching FINAL %s record", state => {
    const s = storage(); persistPending(s, request); completePending(s, request, [row(state)]); expect(restorePending(s)).toBeUndefined();
  });
  it.each(["otherGrant", "otherHash", "pending", "optimistic", "badObservation", "wrongAmount", "missingEvent"])("does not retire a request based on %s", kind => {
    const s = storage(); persistPending(s, request); const r = row(); const o = JSON.parse(r.observation as string);
    if (kind === "otherGrant") r.grantId = "different";
    if (kind === "otherHash") r.hash = "different";
    if (kind === "pending") r.state = "PENDING";
    if (kind === "optimistic") o.finalized = false;
    if (kind === "wrongAmount") o.events[0].data[0].intent.amount = "1";
    if (kind === "missingEvent") o.events = [];
    r.observation = kind === "badObservation" ? "invalid-json" : JSON.stringify(o);
    expect(() => completePending(s, request, [r])).toThrow(); expect(restorePending(s)).toEqual(request);
  });
  it("refuses a different tab's stored request even if this tab has a terminal row", () => {
    const s = storage(); persistPending(s, { ...request, intent_id: "other-tab" }); expect(() => completePending(s, request, [row()])).toThrow();
  });
  it("understands a journal observation built from actual saved successful Testnet callback logs", () => {
    // Reuses public RPC capture; validates parsing only, not a browser E2E run.
    const saved = JSON.parse(readFileSync(new URL("../../docs/evidence/phase3-api-allow-after.json", import.meta.url), "utf8"));
    const events = saved.transaction.receipts_outcome.filter((r: any) => r.outcome.executor_id === "nhat-redline-vault.testnet").flatMap((r: any) => r.outcome.logs.filter((l: string) => l.startsWith("EVENT_JSON:")).map((l: string) => JSON.parse(l.slice(11))));
    expect(canComplete(parsePending(saved.request), [{ hash: saved.transaction.transaction.hash, grantId: saved.request.grant_id, intentId: saved.request.intent_id, state: "SETTLED", observation: JSON.stringify({ transactionHash: saved.transaction.transaction.hash, finalized: true, state: "SETTLED", events }) }])).toBe(true);
  });
});
