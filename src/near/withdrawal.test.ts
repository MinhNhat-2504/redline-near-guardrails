import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ProposalReview } from "./Review";
import { CONTRACT, type Ledger, type Proposal } from "./model";
import { assertLocalRecovery, recoverLocalState } from "./recovery";
import { assertNoWithdrawal, beginWithdrawal, completeWithdrawal, recordWithdrawalHash, restoreWithdrawal, validateWithdrawalProposal, withdrawalKey, withdrawalNear } from "./withdrawal";
const owner = "owner.testnet", id = "wd-" + "a".repeat(32), hash = "B".repeat(44);
const balance: Ledger = { credited: "100", finalized_spent: "10", pending_reserved: "20", completed_withdrawals: "5", pending_withdrawals: "15", storage_available: "99999" };
function storage() { const data = new Map<string, string>(); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; }
const proposal = (): Proposal => ({ network: "testnet", signerId: owner, unsigned: true, transaction: { receiverId: CONTRACT, actions: [{ type: "FunctionCall", params: { methodName: "withdraw", args: { withdrawal_id: id, amount: "50" }, gas: "100000000000000", deposit: "0" } }] } });
const result = (state = "SETTLED") => ({ transactionHash: hash, owner, withdrawalId: id, amount: "50", finalized: true, state, executionBlockHeight: 11, events: [{ event: "withdrawal_completed", data: [{ owner, withdrawal_id: id, withdrawal: { amount: "50", status: state } }] }] });
describe("owner withdrawal safety, local transport only", () => {
  it("parses NEAR without floating point rounding", () => { expect(withdrawalNear("0.000000000000000000000001")).toBe("1"); expect(withdrawalNear("0.01")).toBe("10000000000000000000000"); });
  it.each(["0", "-1", "01", "1e2", "NaN", " 1", "1,2", "0.0000000000000000000000001", "340282366920939"]) ("rejects invalid amount %s", value => expect(() => withdrawalNear(value)).toThrow());
  it("excludes storage, transfer reservations, and previous/pending withdrawals", () => {
    const s = storage(); expect(() => beginWithdrawal(s, owner, id, "51", balance, 10)).toThrow(); expect(s.data.size).toBe(0);
    expect(beginWithdrawal(s, owner, id, "50", balance, 10).amount).toBe("50");
  });
  it("persists before wallet and retains identity on cancellation/reload with no hash", () => {
    const s = storage(), attempt = beginWithdrawal(s, owner, id, "50", balance, 10);
    expect(recoverLocalState(s).withdrawal).toEqual(attempt); expect(() => assertNoWithdrawal(s)).toThrow();
    expect(() => completeWithdrawal(s, attempt, result())).toThrow(); expect(restoreWithdrawal(s)).toEqual(attempt);
    expect(() => beginWithdrawal(s, owner, id, "1", balance, 10)).toThrow();
  });
  it("does not open a wallet when durable storage cannot be read back", () => { const s = storage(); expect(() => beginWithdrawal({ ...s, setItem: () => {} }, owner, id, "50", balance, 10)).toThrow(); });
  it.each(["near-pending-request", "near-owner-funding-attempt"])("blocks withdrawal while %s exists", key => { const s = storage(); s.setItem(key, "{}"); expect(() => beginWithdrawal(s, owner, id, "50", balance, 10)).toThrow(); });
  it("validates the exact proposal and exposes actual withdrawal amount separately from attached deposit", () => {
    const p = proposal(); expect(() => validateWithdrawalProposal(p, owner, { withdrawalId: id, amount: "50" })).not.toThrow();
    const html = renderToStaticMarkup(createElement(ProposalReview, { proposal: p, busy: false, blocked: false, onSign() {}, onCancel() {} }));
    expect(html).toContain("Số tiền rút"); expect(html).toContain("Nhận về ví"); expect(html).toContain(id);
  });
  it.each(["amount", "withdrawal_id", "recipient", "gas", "deposit", "signerId", "receiverId", "unsigned", "extraAction"])("rejects tampered %s", field => {
    const p = proposal(), a = p.transaction.actions[0].params;
    if (["amount", "withdrawal_id", "recipient"].includes(field)) a.args[field] = "different";
    if (field === "gas" || field === "deposit") a[field] = "1";
    if (field === "signerId") p.signerId = "other.testnet";
    if (field === "receiverId") p.transaction.receiverId = "other.testnet";
    if (field === "unsigned") p.unsigned = false;
    if (field === "extraAction") p.transaction.actions.push(p.transaction.actions[0]);
    expect(() => validateWithdrawalProposal(p, owner, { withdrawalId: id, amount: "50" })).toThrow();
  });
  it("cannot replace the saved hash", () => { const s = storage(), a = recordWithdrawalHash(s, beginWithdrawal(s, owner, id, "50", balance, 10), hash); expect(() => recordWithdrawalHash(s, a, "C".repeat(44))).toThrow(); });
  it.each(["SETTLED", "FAILED"])("only completes matching FINAL %s callback", state => { const s = storage(), a = recordWithdrawalHash(s, beginWithdrawal(s, owner, id, "50", balance, 10), hash); completeWithdrawal(s, a, result(state)); expect(restoreWithdrawal(s)).toBeUndefined(); });
  it.each(["hash", "owner", "id", "amount", "optimistic", "oldBlock", "event", "unknown"])("retains attempt on %s", kind => {
    const s = storage(), a = recordWithdrawalHash(s, beginWithdrawal(s, owner, id, "50", balance, 10), hash), r = result();
    if (kind === "hash") r.transactionHash = "C".repeat(44); if (kind === "owner") r.owner = "other.testnet"; if (kind === "id") r.withdrawalId = "other"; if (kind === "amount") r.amount = "1"; if (kind === "optimistic") r.finalized = false; if (kind === "oldBlock") r.executionBlockHeight = 10; if (kind === "event") r.events = []; if (kind === "unknown") r.state = "UNKNOWN";
    expect(() => completeWithdrawal(s, a, r)).toThrow(); expect(restoreWithdrawal(s)).toEqual(a);
  });
  it("corrupt withdrawal blocks writes without erasing records", () => { const s = storage(); s.setItem(withdrawalKey, "{bad"); expect(() => assertLocalRecovery(s)).toThrow(); expect(s.getItem(withdrawalKey)).toBe("{bad"); });
});
