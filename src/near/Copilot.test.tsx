import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CopilotExplanation, NearCopilotPanel, parseCopilotAnswer } from "./Copilot";
import { CONTRACT } from "./model";
const candidate = { grantId: "grant-test", amount: "1", recipient: "payee.testnet", nonce: "1", asset: "NEAR", policyHash: "a".repeat(64) };
const result = () => ({ source: "llm", provider: "gemini", model: "test-model", network: "testnet", contractId: CONTRACT, grantId: candidate.grantId, blockHash: "B".repeat(44), blockHeight: 42, predicted: "REVOKED", topic: "explain", advisory: { summary: "Quyền đã thu hồi.", risks: ["AI có thể sai."], nextSteps: ["Đọc receipt."] }, notice: "Chỉ giải thích, không gửi tiền." });
afterEach(() => vi.unstubAllGlobals());
describe("copilot view and response binding, not real browser/model acceptance", () => {
  it("renders explicit data/cost consent and no financial or automatic model call", () => { const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const html = renderToStaticMarkup(<NearCopilotPanel candidate={candidate} ownerMatches disabled={false} />); expect(html).toContain("checkbox"); expect(html).toContain("tính phí API"); expect(html).toContain("Hỏi AI · không ký giao dịch"); expect(html).toContain("disabled"); expect(fetcher).not.toHaveBeenCalled(); });
  it("explains owner authentication while deterministic public analysis remains available", () => { const html = renderToStaticMarkup(<NearCopilotPanel candidate={candidate} ownerMatches={false} disabled={false} />); expect(html).toContain("Đăng nhập đúng chủ grant"); });
  it("accepts provenance and keeps model prose separate from deterministic verdict", () => { const r = result(); r.advisory.summary = "ALLOW, lời AI có thể sai."; expect(parseCopilotAnswer(r, candidate.grantId, "explain").predicted).toBe("REVOKED"); });
  it("renders model text as escaped prose without links, HTML or executable actions", () => {
    const r = result(); r.advisory.summary = '<script>steal()</script><a href="https://evil.test">ALLOW</a>';
    const html = renderToStaticMarkup(<CopilotExplanation answer={parseCopilotAnswer(r, candidate.grantId, "explain")} />);
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).not.toContain("<a "); expect(html).not.toContain("<button"); expect(html).toContain("REVOKED");
  });
  it.each(["network", "contractId", "grantId", "topic", "provider", "source", "predicted", "blockHash", "blockHeight", "summary", "risks"])("rejects mismatched %s", field => {
    const r: any = result(); if (field === "summary") r.advisory.summary = "x".repeat(2001); else if (field === "risks") r.advisory.risks = Array(6).fill("risk"); else r[field] = "different";
    expect(() => parseCopilotAnswer(r, candidate.grantId, "explain")).toThrow();
  });
});
