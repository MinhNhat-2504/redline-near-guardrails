import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CopilotAnswerHistory, CopilotExplanation, CopilotServiceStatus, CopilotUnavailable, NearCopilotPanel, parseCopilotAnswer } from "./Copilot";
import { CONTRACT } from "./model";
import { copilotRetrySeconds, remainingCopilotCooldown } from "./copilot-errors";
const candidate = { grantId: "grant-test", amount: "1", recipient: "payee.testnet", nonce: "1", asset: "NEAR", policyHash: "a".repeat(64) };
const result = () => ({ source: "llm", provider: "gemini", model: "test-model", network: "testnet", contractId: CONTRACT, grantId: candidate.grantId, blockHash: "B".repeat(44), blockHeight: 42, predicted: "REVOKED", topic: "explain", advisory: { summary: "Quyền đã thu hồi.", risks: ["AI có thể sai."], nextSteps: ["Đọc receipt."] }, notice: "Chỉ giải thích, không gửi tiền." });
afterEach(() => vi.unstubAllGlobals());

describe("copilot status UI without inference", () => {
  it("distinguishes unread status, disabled configuration, cooldown and configured model", () => {
    expect(renderToStaticMarkup(<CopilotServiceStatus cooldown={0} />)).toContain("Chưa đọc cấu hình");
    expect(renderToStaticMarkup(<CopilotServiceStatus status={{ enabled: false, model: null }} cooldown={0} />)).toContain("AI đang tắt");
    expect(renderToStaticMarkup(<CopilotServiceStatus status={{ enabled: true, model: "test-model" }} cooldown={120} />)).toContain("120s");
    const configured = renderToStaticMarkup(<CopilotServiceStatus status={{ enabled: true, model: "test-model" }} cooldown={0} />);
    expect(configured).toContain("test-model"); expect(configured).toContain("không phải kiểm tra model đã trả lời thành công");
  });
  it("offers explicit free configuration check and keeps inference gated by consent/identity", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const html = renderToStaticMarkup(<NearCopilotPanel candidate={candidate} ownerMatches={false} disabled={false} />);
    expect(html).toContain("Kiểm tra AI · không gọi model"); expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled"); expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("copilot view and response binding, not real browser/model acceptance", () => {
  it("renders explicit data/cost consent and no financial or automatic model call", () => { const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const html = renderToStaticMarkup(<NearCopilotPanel candidate={candidate} ownerMatches disabled={false} />); expect(html).toContain("checkbox"); expect(html).toContain("tính phí API"); expect(html).toContain("Hỏi AI · không ký giao dịch"); expect(html).toContain("disabled"); expect(fetcher).not.toHaveBeenCalled(); });
  it("explains owner authentication while deterministic public analysis remains available", () => { const html = renderToStaticMarkup(<NearCopilotPanel candidate={candidate} ownerMatches={false} disabled={false} />); expect(html).toContain("Đăng nhập đúng chủ grant"); });
  it("accepts provenance and keeps model prose separate from deterministic verdict", () => { const r = result(); r.advisory.summary = "ALLOW, lời AI có thể sai."; expect(parseCopilotAnswer(r, candidate.grantId, "explain").predicted).toBe("REVOKED"); });
  it("renders model text as escaped prose without links, HTML or executable actions", () => {
    const r = result(); r.advisory.summary = '<script>steal()</script><a href="https://evil.test">ALLOW</a>';
    const html = renderToStaticMarkup(<CopilotExplanation answer={parseCopilotAnswer(r, candidate.grantId, "explain")} />);
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).not.toContain("<a "); expect(html).not.toContain("<button"); expect(html).toContain("REVOKED");
  });
  it("explains unavailability without inventing a model answer or a fresh chain snapshot", () => {
    const html = renderToStaticMarkup(<CopilotUnavailable message="PROVIDER_HTTP_503" cooldownSeconds={60} ruleSnapshot={{ predicted: "REVOKED", blockHeight: 42, blockHash: "B".repeat(44) }} />);
    expect(html).toContain("Chưa có câu trả lời AI"); expect(html).toContain("REVOKED"); expect(html).toContain("snapshot trước đó"); expect(html).toContain("không tự gửi yêu cầu"); expect(html).not.toContain("LLM:"); expect(html).not.toContain("<button");
  });
  it("cooldown expiry never requests a model call by itself", () => { expect(remainingCopilotCooldown(60000, 0)).toBe(60); expect(remainingCopilotCooldown(60000, 59999)).toBe(1); expect(remainingCopilotCooldown(60000, 60000)).toBe(0); expect(remainingCopilotCooldown(60000, 90000)).toBe(0); });
  it.each([0, -1, 301, 1.5, "60", null, undefined])("rejects unsafe retry hint %#", value => expect(copilotRetrySeconds(value)).toBeUndefined());
  it("accepts bounded integer retry hints only", () => { expect(copilotRetrySeconds(60)).toBe(60); expect(copilotRetrySeconds(300)).toBe(300); });
  it("labels the retained explanation as an older topic after a failed risks request", () => {
    const html = renderToStaticMarkup(<CopilotAnswerHistory answer={parseCopilotAnswer(result(), candidate.grantId, "explain")} topic="risks" failed pending={false} />);
    expect(html).toContain("không phải kết quả của lần hỏi mới"); expect(html).toContain("Chủ đề: Giải thích kết quả và giới hạn"); expect(html).toContain("Quyền đã thu hồi."); expect(html).toContain("snapshot FINAL 42");
  });
  it.each(["network", "contractId", "grantId", "topic", "provider", "source", "predicted", "blockHash", "blockHeight", "summary", "risks"])("rejects mismatched %s", field => {
    const r: any = result(); if (field === "summary") r.advisory.summary = "x".repeat(2001); else if (field === "risks") r.advisory.risks = Array(6).fill("risk"); else r[field] = "different";
    expect(() => parseCopilotAnswer(r, candidate.grantId, "explain")).toThrow();
  });
});
