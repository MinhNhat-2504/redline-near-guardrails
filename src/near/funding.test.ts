import { describe, expect, it } from "vitest";
import { assertFundingNeeded, beginFunding, completeFunding, parseFundingStatus, recordFundingHash, restoreFunding, type FundingStatus } from "./funding";
import { CONTRACT, PRINCIPAL_FUNDING, STORAGE_FUNDING, validateProposal, type Proposal } from "./model";
const owner = "web.testnet", hash = "B".repeat(44);
const unregistered: FundingStatus = { registered: false, blockHeight: 100, blockHash: hash };
const registered: FundingStatus = { registered: true, blockHeight: 101, blockHash: hash, value: { credited: "0", finalized_spent: "0", pending_reserved: "0", completed_withdrawals: "0", pending_withdrawals: "0", storage_available: "48000000000000000000000" } };
function storage() { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; }
function proposal(method: "storage_deposit" | "deposit"): Proposal { return { network: "testnet", unsigned: true, signerId: owner, transaction: { receiverId: CONTRACT, actions: [{ type: "FunctionCall", params: { methodName: method, args: {}, deposit: method === "deposit" ? PRINCIPAL_FUNDING : STORAGE_FUNDING, gas: "100000000000000" } }] } }; }
describe("owner funding review boundaries, synthetic only", () => {
  it("registers storage before initial principal, without replenishing spent balances automatically", () => {
    expect(() => assertFundingNeeded("storage_deposit", unregistered)).not.toThrow();
    expect(() => assertFundingNeeded("deposit", unregistered)).toThrow();
    expect(() => assertFundingNeeded("storage_deposit", registered)).toThrow();
    expect(() => assertFundingNeeded("deposit", registered)).not.toThrow();
    expect(() => assertFundingNeeded("deposit", { ...registered, value: { ...registered.value, credited: PRINCIPAL_FUNDING, finalized_spent: "10000000000000000000000" } })).toThrow();
  });
  it.each(["storage_deposit", "deposit"] as const)("validates exact reviewed %s method and amount", async method => { await expect(validateProposal(proposal(method), owner, method)).resolves.toBeUndefined(); const p = proposal(method); p.transaction.actions[0].params.deposit = "1"; await expect(validateProposal(p, owner, method)).rejects.toThrow(); });
  it("refuses extra arguments, extra actions and substituted signer", async () => {
    for (const kind of ["args", "actions", "signer"]) { const p = proposal("deposit"); if (kind === "args") p.transaction.actions[0].params.args = { owner: "other.testnet" }; if (kind === "actions") p.transaction.actions.push(p.transaction.actions[0]); if (kind === "signer") p.signerId = "other.testnet"; await expect(validateProposal(p, owner, "deposit")).rejects.toThrow(); }
  });
  it("persists before signing, blocks replacement and clears only exact FINAL newer confirmation", () => {
    const s = storage(); let a = beginFunding(s, owner, "storage_deposit", unregistered);
    expect(() => beginFunding(s, owner, "storage_deposit", unregistered)).toThrow();
    a = recordFundingHash(s, a, hash); expect(restoreFunding(s)).toEqual(a);
    const result = { transactionHash: hash, method: a.method, amount: a.amount, finalized: true, state: "CONFIRMED", executionBlockHeight: 101 };
    for (const patch of [{ finalized: false }, { transactionHash: "C".repeat(44) }, { amount: "1" }, { executionBlockHeight: 100 }, { state: "UNKNOWN" }]) expect(() => completeFunding(s, a, { ...result, ...patch })).toThrow();
    completeFunding(s, a, result); expect(restoreFunding(s)).toBeUndefined();
  });
  it("does not sign on storage failure or silently replace a corrupt attempt", () => {
    expect(() => beginFunding({ ...storage(), setItem: () => { throw Error("Quota"); } }, owner, "storage_deposit", unregistered)).toThrow("Quota");
    const s = storage(); s.setItem("near-owner-funding-attempt", "broken"); expect(() => restoreFunding(s)).toThrow(); expect(() => beginFunding(s, owner, "storage_deposit", unregistered)).toThrow();
  });
  it("does not accept malformed snapshot metadata, a fake zero ledger, or overspent principal", () => {
    expect(() => parseFundingStatus({ ...unregistered, blockHeight: undefined })).toThrow();
    expect(() => parseFundingStatus({ ...unregistered, value: registered.value })).toThrow();
    expect(() => parseFundingStatus({ ...registered, value: { ...registered.value, finalized_spent: "1" } })).toThrow();
    expect(() => parseFundingStatus(registered)).not.toThrow();
  });
});
