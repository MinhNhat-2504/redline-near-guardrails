import { useState } from "react";
import { api, NearApiError } from "./api";
import { CONTRACT } from "./model";
type Candidate = { grantId: string; amount: string; recipient: string; nonce: string; asset: string; policyHash: string; intentId?: string };
type Topic = "explain" | "risks" | "next_steps";
type Answer = { source: "llm"; provider: "gemini"; model: string; network: string; contractId: string; grantId: string; blockHeight: number; blockHash: string; predicted: string; topic: Topic; advisory: { summary: string; risks: string[]; nextSteps: string[] }; notice: string };
const predictions = ["ALLOW", "REVOKED", "EXPIRED", "NONCE_REPLAY", "ASSET_NOT_ALLOWED", "DESTINATION_NOT_ALLOWED", "TX_CAP_EXCEEDED", "SPEND_CAP_EXCEEDED", "COOLDOWN_ACTIVE", "POLICY_HASH_MISMATCH", "INVALID_AMOUNT", "INSUFFICIENT_BALANCE"];
export function parseCopilotAnswer(value: unknown, grantId: string, topic: Topic): Answer {
  const r = value as Answer;
  const text = (x: unknown, max: number) => typeof x === "string" && x.length > 0 && x.length <= max;
  const list = (x: unknown) => Array.isArray(x) && x.length <= 5 && x.every(v => text(v, 500));
  if (!r || r.source !== "llm" || r.provider !== "gemini" || !text(r.model, 100) || r.network !== "testnet" || r.contractId !== CONTRACT || r.grantId !== grantId || r.topic !== topic || !Number.isSafeInteger(r.blockHeight) || r.blockHeight < 0 || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r.blockHash) || !predictions.includes(r.predicted) || !r.advisory || !text(r.advisory.summary, 2000) || !list(r.advisory.risks) || !list(r.advisory.nextSteps) || !text(r.notice, 1000)) throw Error("Phản hồi copilot không khớp đề xuất NEAR đang xem.");
  return r;
}
/** No callback to financial actions: model text cannot prepare, sign or submit. */
export function NearCopilotPanel({ candidate, ownerMatches, disabled, onSessionExpired }: { candidate: Candidate; ownerMatches: boolean; disabled: boolean; onSessionExpired?: () => void }) {
  const [consent, setConsent] = useState(false), [topic, setTopic] = useState<Topic>("explain"), [answer, setAnswer] = useState<Answer>(), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  async function explain() {
    setError(""); setAnswer(undefined); setLoading(true);
    try {
      const status = await api<{ enabled: boolean }>("/near/copilot/status");
      if (status.enabled !== true) throw Error("Copilot LLM chưa được bật trên backend. Bạn vẫn dùng được phần phân tích bằng quy tắc ở trên.");
      setAnswer(parseCopilotAnswer(await api("/near/copilot/explain", { candidate, topic, consent: true }), candidate.grantId, topic));
    } catch (e) { if (e instanceof NearApiError && e.status === 401 && !e.staleSession) onSessionExpired?.(); setError(e instanceof Error ? e.message : "Chưa nhận được phản hồi LLM."); } finally { setLoading(false); }
  }
  return <section className="nw-copilot-panel" aria-labelledby="near-llm-title"><span className="nw-eyebrow">AI EXPLANATION · CHỈ ĐỌC</span><h3 id="near-llm-title">Hỏi copilot về đề xuất này</h3>
    <p>AI giải thích dữ liệu ở snapshot FINAL mới được backend đọc lại. Kết quả có thể khác snapshot phía trên nếu chain đã thay đổi. AI không thay kết luận quy tắc, không tạo quyền và không gửi tiền.</p>
    {!ownerMatches && <p>Đăng nhập đúng chủ grant để gọi LLM. Phân tích bằng quy tắc vẫn xem được không cần đăng nhập.</p>}
    <label>Bạn muốn hiểu điều gì?<select disabled={loading} value={topic} onChange={e => { setTopic(e.target.value as Topic); setAnswer(undefined); setError(""); }}><option value="explain">Giải thích kết quả và giới hạn</option><option value="risks">Rủi ro còn lại cần lưu ý</option><option value="next_steps">Bước kiểm tra tiếp theo</option></select></label>
    <label className="nw-copilot-consent"><input type="checkbox" checked={consent} disabled={loading} onChange={e => setConsent(e.target.checked)} /><span>Tôi đồng ý gửi số tiền, nonce, hạn mức, số dư khả dụng và kết quả gate tới Gemini để giải thích. Backend không gửi địa chỉ ví, mã grant/intent, khóa hay session. Lời gọi có thể tính phí API của máy chủ.</span></label>
    <button disabled={disabled || loading || !ownerMatches || !consent} onClick={() => void explain()}>{loading ? "Đang hỏi copilot…" : "Hỏi AI · không ký giao dịch"}</button>
    {error && <p className="near-error" role="alert">{error}</p>}
    {answer && <CopilotExplanation answer={answer} />}
  </section>;
}
export function CopilotExplanation({ answer }: { answer: Answer }) {
  return <div className="near-review" aria-live="polite"><p>LLM: {answer.model} · snapshot FINAL {answer.blockHeight} · <code>{answer.blockHash}</code></p><h4>Kết luận quy tắc của snapshot này: {answer.predicted}</h4><p>{answer.advisory.summary}</p><h4>AI lưu ý</h4><ul>{answer.advisory.risks.map((x, i) => <li key={i}>{x}</li>)}</ul><h4>AI đề xuất kiểm tra</h4><ul>{answer.advisory.nextSteps.map((x, i) => <li key={i}>{x}</li>)}</ul><p className="near-muted">{answer.notice}</p></div>;
}
