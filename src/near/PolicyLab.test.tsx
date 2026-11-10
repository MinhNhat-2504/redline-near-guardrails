import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { labHandoff, NearPolicyLab, parseLabAmount } from "./PolicyLab";
import { CAP, CONTRACT, PAYEE } from "./model";
const report = { network: "testnet", contractId: CONTRACT, grantId: "g", owner: "alice.testnet", blockHeight: 42, blockHash: "B".repeat(44), predicted: "ALLOW", notice: "Preview", candidate: { grantId: "g", nonce: "1", amount: "10000000000000000000000", recipient: PAYEE, asset: "NEAR", policyHash: "a".repeat(64) }, grant: { next_nonce: "1", policy: { policy_hash: "a".repeat(64), spend_cap: CAP } }, ledger: { credited: CAP, pending_reserved: "0", finalized_spent: "0", completed_withdrawals: "0", pending_withdrawals: "0" }, gates: [] };
describe("NEAR lab browser safety boundaries", () => {
  it("keeps one yocto and values beyond Number precision exact", () => {
    expect(parseLabAmount("0.000000000000000000000001")).toBe("1");
    expect(parseLabAmount("9007199254.740993")).toBe("9007199254740993000000000000000000");
  });
  it.each(["1e3", "01", "-1", ".01", "1.", "0.0000000000000000000000001", "340282366920939"])("rejects lossy money %s", value => { expect(() => parseLabAmount(value)).toThrow(); });
  it("creates a new candidate for durable review, with no signing or network side effects", () => {
    expect(labHandoff(report, report.owner, "g")).toMatchObject({ grant_id: "g", intent_id: expect.stringMatching(/^lab-/), nonce: "1", amount: report.candidate.amount, recipient: PAYEE });
  });
  it.each([{ network: "mainnet" }, { contractId: "evil.testnet" }, { owner: "evil.testnet" }, { predicted: "REVOKED" }, { grantId: "other" }, { candidate: { ...report.candidate, intentId: "old" } }, { candidate: { ...report.candidate, asset: "USDC" } }, { candidate: { ...report.candidate, recipient: "evil.testnet" } }, { candidate: { ...report.candidate, nonce: "0" } }, { candidate: { ...report.candidate, amount: (BigInt(CAP) + 1n).toString() } }, { candidate: { ...report.candidate, policyHash: "b".repeat(64) } }])("refuses unsafe handoff %#", patch => {
    expect(() => labHandoff({ ...report, ...patch }, report.owner, "g")).toThrow();
  });
  it("labels deterministic read-only analysis and never renders a wallet signing control", () => {
    const html = renderToStaticMarkup(<NearPolicyLab grantId="g" owner="" nonce="1" policyHash={report.candidate.policyHash} disabled={false} onReview={() => { throw Error("must not run"); }} />);
    expect(html).toContain("Kết quả dựa trên dữ liệu NEAR đã xác nhận"); expect(html).toContain("Phần giải thích AI là lựa chọn riêng"); expect(html).toContain("Phân tích · chỉ đọc"); expect(html).not.toContain("Mở ví ký");
  });
  it("keeps read-only analysis enabled while a saved request blocks new intent review", () => {
    const html = renderToStaticMarkup(<NearPolicyLab grantId="g" owner="alice.testnet" nonce="1" policyHash={report.candidate.policyHash} disabled={false} reviewBlocked onReview={() => { throw Error("must not run"); }} />);
    expect(html).not.toContain('<fieldset disabled');
    expect(html).toContain("Bạn vẫn phân tích chỉ đọc được");
    expect(html).toContain("chưa tạo intent mới");
    expect(html).toContain("Phân tích · chỉ đọc");
  });
});
