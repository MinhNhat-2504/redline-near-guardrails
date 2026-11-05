import { describe, expect, it } from "vitest";
import { assertLocalRecovery, recoverLocalState, recoverStartup, startupGrant } from "./recovery";
import { beginFunding, completeFunding, recordFundingHash } from "./funding";
import { completePending, persistPending } from "./pending";

const request = { grant_id: "demo", intent_id: "saved-intent", nonce: "1", asset: "NEAR", recipient: "payee.testnet", amount: "1", policy_hash: "a".repeat(64) };
const hash = "B".repeat(44);
function storage(data = new Map<string, string>()) { return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; }
function funding(s: ReturnType<typeof storage>) { return beginFunding(s, "owner.testnet", "storage_deposit", { registered: false, blockHeight: 42, blockHash: hash }); }
describe("offline startup and reload recovery (no browser or wallet transport)", () => {
  it("a foreign URL cannot strand a saved intent on another grant, while fresh links still work", () => {
    expect(startupGrant("foreign-grant", { request: request as any, grantId: "old" })).toBe(request.grant_id);
    expect(startupGrant("chosen", { grantId: "old" })).toBe("chosen");
    expect(startupGrant(null, { grantId: "old" })).toBe("old"); expect(startupGrant(null, {})).toBe("");
  });
  it("fresh visitor starts empty without reading network or changing storage", () => {
    const s = storage(); expect(recoverLocalState(s)).toEqual({ funding: undefined, request: undefined, errors: [] }); expect(s.data.size).toBe(0);
  });
  it("a new page restores exact request and no-hash funding even when API is not running", () => {
    const s = storage(); persistPending(s, request); const a = funding(s), before = JSON.stringify([...s.data]);
    const newPage = storage(s.data), result = recoverLocalState(newPage);
    expect(result).toMatchObject({ request, funding: a, errors: [] }); expect(result.funding?.hash).toBeUndefined();
    expect(JSON.stringify([...s.data])).toBe(before);
    expect(() => persistPending(newPage, { ...request, intent_id: "replacement" })).toThrow();
    expect(() => funding(newPage)).toThrow();
  });
  it("retains wallet-returned funding hash after reload, without treating it as confirmation", () => {
    const s = storage(), a = recordFundingHash(s, funding(s), hash);
    const restored = recoverLocalState(storage(s.data)); expect(restored.funding).toEqual(a);
    expect(() => completeFunding(s, a, { transactionHash: hash, state: "UNKNOWN", finalized: false })).toThrow();
    expect(recoverLocalState(s).funding).toEqual(a);
  });
  it("a missing hash after wallet cancellation/closure never unlocks a replacement funding", () => {
    const s = storage(), a = funding(s);
    // Both definitive wallet rejection and ambiguous transport closure leave this same local record.
    // These local tests do not establish that either browser wallet operation actually happened.
    expect(() => completeFunding(s, a, { finalized: false, state: "CANCELLED" })).toThrow();
    expect(() => funding(storage(s.data))).toThrow(); expect(recoverLocalState(s).funding).toEqual(a);
  });
  it("corrupt funding does not hide a valid intent; all writes fail closed", () => {
    const s = storage(); persistPending(s, request); s.setItem("near-owner-funding-attempt", "{bad");
    expect(recoverLocalState(s)).toMatchObject({ request, funding: undefined, errors: [expect.stringContaining("funding")] });
    expect(() => assertLocalRecovery(s)).toThrow(); expect(s.getItem("near-owner-funding-attempt")).toBe("{bad");
  });
  it("corrupt intent does not hide valid funding or erase either record", () => {
    const s = storage(), a = funding(s); s.setItem("near-pending-request", "{bad");
    expect(recoverLocalState(s)).toMatchObject({ request: undefined, funding: a, errors: [expect.stringContaining("intent")] });
    expect(() => assertLocalRecovery(s)).toThrow(); expect(s.getItem("near-pending-request")).toBe("{bad");
  });
  it("blocked storage produces explicit recovery errors rather than claiming empty state", () => {
    const s = { ...storage(), getItem: () => { throw Error("SecurityError"); } };
    expect(recoverLocalState(s).errors).toHaveLength(2); expect(() => assertLocalRecovery(s)).toThrow();
  });
  it("handles a blocked browser localStorage getter before rendering recovery controls", () => {
    const saved = recoverStartup(() => { throw Error("SecurityError"); });
    expect(saved.errors).toHaveLength(1); expect(saved.errors[0]).toContain("không coi là trạng thái trống");
  });
  it("prefers a saved intent's grant over stale navigation metadata, never submits it", () => {
    const s = storage(); persistPending(s, request); s.setItem("near-grant", "unrelated");
    expect(recoverStartup(() => s).grantId).toBe(request.grant_id);
    expect(recoverStartup(() => storage()).grantId).toBeUndefined();
    const empty = storage(); empty.setItem("near-grant", "javascript:invalid"); expect(recoverStartup(() => empty).grantId).toBeUndefined();
  });
  it("UNKNOWN or an empty journal after restart cannot complete a saved transfer", () => {
    const s = storage(); const r = persistPending(s, request);
    expect(() => completePending(storage(s.data), r, [])).toThrow(); expect(recoverLocalState(s).request).toEqual(r);
  });
});
