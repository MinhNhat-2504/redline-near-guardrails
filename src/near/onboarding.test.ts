import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { nextStep, parseAccountSnapshot, explorerUrl } from "./onboarding";
import { ReceiptLink } from "./ReceiptLink";
import type { Grant } from "./model";
import type { FundingStatus } from "./funding";
const owner = "web.testnet", hash = "B".repeat(44);
const funds: FundingStatus = { registered: true, blockHeight: 42, blockHash: hash, value: { credited: "100000000000000000000000", finalized_spent: "0", pending_reserved: "0", pending_withdrawals: "0", completed_withdrawals: "0", storage_available: "48000000000000000000000" } };
const grant = { owner, active: true, finalized_transactions: 0, policy: { expires_at_ns: "3600000000000" } } as Grant;
const base = { ready: true, owner, funds, grant, pendingFunding: false, pendingRequest: false, requestFinal: false, now: 0 };
describe("guided steps never sign or create authority", () => {
  it("prioritizes login, funding ambiguity and unresolved request over new setup", () => {
    expect(nextStep({ ...base, owner: "" }).target).toBe("near-owner");
    expect(nextStep({ ...base, pendingFunding: true }).text).toContain("Không ký");
    expect(nextStep({ ...base, pendingRequest: true }).text).toContain("Không tạo ID");
    expect(nextStep({ ...base, pendingRequest: true, requestFinal: true }).text).toContain("kết thúc request cũ");
  });
  it("handles missing/unregistered/storage-only vaults", () => {
    expect(nextStep({ ...base, funds: undefined }).text).toContain("đọc vault");
    expect(nextStep({ ...base, funds: { registered: false, blockHeight: 1, blockHash: hash } }).text).toContain("storage");
    expect(nextStep({ ...base, funds: { ...funds, value: { ...funds.value, credited: "0" } } }).text).toContain("principal");
  });
  it("never suggests using another owner's grant or funding an expired/revoked demo", () => {
    expect(nextStep({ ...base, grant: { ...grant, owner: "foreign.testnet" } }).target).toBe("near-grant");
    expect(nextStep({ ...base, grant: { ...grant, active: false } }).text).toContain("không cần nạp lại");
    expect(nextStep({ ...base, now: 3600001 }).text).toContain("không cần nạp lại");
    expect(nextStep(base).text).toContain("ALLOW");
    expect(nextStep({ ...base, grant: { ...grant, finalized_transactions: 1 } }).text).toContain("replay");
  });
  it("refuses mainnet, foreign account, unsafe metadata and rounded native amounts", () => {
    const v = { network: "testnet", accountId: owner, amount: "2350000000000000000000000", locked: "0", storageUsage: 182, blockHeight: 42, blockHash: hash };
    expect(parseAccountSnapshot(v, owner).amount).toBe(v.amount);
    for (const patch of [{ network: "mainnet" }, { accountId: "foreign.testnet" }, { amount: 1 }, { amount: "01" }, { amount: (1n << 128n).toString() }, { blockHeight: -1 }]) expect(() => parseAccountSnapshot({ ...v, ...patch }, owner)).toThrow();
  });
  it("provides a selectable full hash, explicit copy controls and Testnet link", () => {
    const html = renderToStaticMarkup(createElement(ReceiptLink, { hash }));
    expect(html).toContain(explorerUrl(hash)); expect(html).toContain(hash); expect(html).toContain("Sao chép hash"); expect(html).toContain("Sao chép link");
    expect(() => explorerUrl("javascript:bad")).toThrow();
    expect(renderToStaticMarkup(createElement(ReceiptLink, { hash: "invalid" }))).not.toContain("href=");
  });
});
