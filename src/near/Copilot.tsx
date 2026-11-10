import { useEffect, useRef, useState } from "react";
import { api, NearApiError } from "./api";
import { CONTRACT } from "./model";
import { copilotRetrySeconds, remainingCopilotCooldown } from "./copilot-errors";
type Candidate = { grantId: string; amount: string; recipient: string; nonce: string; asset: string; policyHash: string; intentId?: string };
type Topic = "explain" | "risks" | "next_steps";
const topicLabels = { explain: "Giải thích kết quả và giới hạn", risks: "Rủi ro còn lại cần lưu ý", next_steps: "Bước kiểm tra tiếp theo" };
type RuleSnapshot = { predicted: string; blockHeight: number; blockHash: string };
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
export function NearCopilotPanel({ candidate, ownerMatches, disabled, onSessionExpired, ruleSnapshot }: { candidate: Candidate; ownerMatches: boolean; disabled: boolean; onSessionExpired?: () => void; ruleSnapshot?: RuleSnapshot }) {
  const [consent, setConsent] = useState(false), [topic, setTopic] = useState<Topic>("explain"), [answer, setAnswer] = useState<Answer>(), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0), [now, setNow] = useState(Date.now());
  const [providerStatus, setProviderStatus] = useState<{ enabled: boolean; model: string | null }>();
  const [checking, setChecking] = useState(false);
  const locked = useRef(false);
  const cooldown = remainingCopilotCooldown(cooldownUntil, now);
  useEffect(() => { if (!cooldownUntil) return; const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= cooldownUntil) setCooldownUntil(0); }, 1000); return () => clearInterval(timer); }, [cooldownUntil]);
  async function status() {
    const value = await api<{ enabled: boolean; model: string | null; cooldownSeconds?: number }>("/near/copilot/status");
    if (typeof value?.enabled !== "boolean" || (value.model !== null && (typeof value.model !== "string" || value.model.length > 100))) throw Error("Chưa xác minh được cấu hình AI từ backend.");
    setProviderStatus({ enabled: value.enabled, model: value.model });
    const wait = copilotRetrySeconds(value.cooldownSeconds);
    if (wait) { const time = Date.now(); setNow(time); setCooldownUntil(until => Math.max(until, time + wait * 1000)); }
    return { ...value, wait };
  }
  async function checkStatus() {
    if (locked.current) return;
    locked.current = true; setLoading(true); setChecking(true); setError("");
    try { await status(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không đọc được trạng thái AI."); }
    finally { locked.current = false; setLoading(false); setChecking(false); }
  }
  async function explain() {
    if (locked.current || disabled || !ownerMatches || !consent || remainingCopilotCooldown(cooldownUntil)) return;
    locked.current = true;
    setError(""); setLoading(true);
    try {
      const current = await status();
      if (current.enabled !== true) throw Error("Copilot LLM chưa được bật trên backend. Bạn vẫn dùng được phần phân tích bằng quy tắc ở trên.");
      const wait = current.wait;
      if (wait) throw new NearApiError(503, "PROVIDER_COOLDOWN", false, wait);
      setAnswer(parseCopilotAnswer(await api("/near/copilot/explain", { candidate, topic, consent: true }), candidate.grantId, topic));
    } catch (e) {
      if (e instanceof NearApiError) {
        if (e.status === 401 && !e.staleSession) onSessionExpired?.();
        const wait = copilotRetrySeconds(e.retryAfterSeconds); if (wait) { const time = Date.now(); setNow(time); setCooldownUntil(time + wait * 1000); }
      }
      setError(e instanceof Error ? e.message : "Chưa nhận được phản hồi LLM.");
    } finally { locked.current = false; setLoading(false); }
  }
  return <section className="nw-copilot-panel" aria-labelledby="near-llm-title"><span className="nw-eyebrow">AI EXPLANATION · CHỈ ĐỌC</span><h3 id="near-llm-title">Hỏi copilot về đề xuất này</h3>
    <p>AI giải thích dữ liệu ở snapshot FINAL mới được backend đọc lại. Kết quả có thể khác snapshot phía trên nếu chain đã thay đổi. AI không thay kết luận quy tắc, không tạo quyền và không gửi tiền.</p>
    <div className="nw-copilot-status"><button disabled={loading} onClick={() => void checkStatus()}>Kiểm tra AI · không gọi model</button><CopilotServiceStatus status={providerStatus} cooldown={cooldown} /></div>
    {!ownerMatches && <p>Đăng nhập đúng chủ grant để gọi LLM. Phân tích bằng quy tắc vẫn xem được không cần đăng nhập.</p>}
    <label>Bạn muốn hiểu điều gì?<select disabled={loading} value={topic} onChange={e => { setTopic(e.target.value as Topic); setError(""); }}><option value="explain">Giải thích kết quả và giới hạn</option><option value="risks">Rủi ro còn lại cần lưu ý</option><option value="next_steps">Bước kiểm tra tiếp theo</option></select></label>
    <label className="nw-copilot-consent"><input type="checkbox" checked={consent} disabled={loading} onChange={e => setConsent(e.target.checked)} /><span>Tôi đồng ý gửi số tiền, nonce, hạn mức, số dư khả dụng và kết quả gate tới Gemini để giải thích. Backend không gửi địa chỉ ví, mã grant/intent, khóa hay session. Lời gọi có thể tính phí API của máy chủ.</span></label>
    <button disabled={disabled || loading || !ownerMatches || !consent || cooldown > 0} onClick={() => void explain()}>{loading ? checking ? "Đang kiểm tra cấu hình…" : "Đang hỏi copilot…" : cooldown ? `Tạm nghỉ AI · ${cooldown}s` : "Hỏi AI · không ký giao dịch"}</button>
    {loading && !checking && <p role="status">Đang chờ phản hồi AI. Không có lượt gọi lại tự động; phân tích quy tắc vẫn xem được.</p>}
    {error && <CopilotUnavailable message={error} cooldownSeconds={cooldown} ruleSnapshot={ruleSnapshot} />}
    {answer && <CopilotAnswerHistory answer={answer} topic={topic} failed={!!error} pending={loading} />}
  </section>;
}
export function CopilotServiceStatus({ status, cooldown }: { status?: { enabled: boolean; model: string | null }; cooldown: number }) {
  return <p role="status">{!status ? "Chưa đọc cấu hình AI. Bạn vẫn dùng được phân tích quy tắc." : !status.enabled ? "AI đang tắt. Phần NEAR và phân tích quy tắc vẫn hoạt động." : cooldown > 0 ? `AI tạm nghỉ ${cooldown}s. Không có lượt gọi lại tự động.` : `Đã bật cấu hình Gemini · ${status.model ?? "chưa rõ model"}. Đây không phải kiểm tra model đã trả lời thành công.`}</p>;
}
export function CopilotAnswerHistory({ answer, topic, failed, pending }: { answer: Answer; topic: Topic; failed: boolean; pending: boolean }) {
  return <><p className="near-muted">{answer.topic !== topic || failed || pending ? "Câu trả lời trước — không phải kết quả của lần hỏi mới." : "Câu trả lời đã nhận."} Chủ đề: {topicLabels[answer.topic]}.</p><CopilotExplanation answer={answer} /></>;
}
export function CopilotUnavailable({ message, cooldownSeconds = 0, ruleSnapshot }: { message: string; cooldownSeconds?: number; ruleSnapshot?: RuleSnapshot }) {
  return <div className="near-review" role="alert"><h4>Chưa có câu trả lời AI cho lần hỏi này</h4><p className="near-error">{message}</p>{cooldownSeconds > 0 && <p>Tạm chặn gọi AI trong {cooldownSeconds} giây. Hết thời gian chỉ mở lại nút, không tự gửi yêu cầu.</p>}
    <p>Phần phân tích bằng quy tắc phía trên vẫn xem được, không cần gọi LLM.</p>{ruleSnapshot && <p>Kết luận quy tắc đã tải: <strong>{ruleSnapshot.predicted}</strong> · FINAL block {ruleSnapshot.blockHeight} · <code>{ruleSnapshot.blockHash}</code>. Đây là snapshot trước đó, không phải lần đọc mới hay receipt thanh toán.</p>}
    <ul><li>Xem gate BLOCK và các gate NOT_EVALUATED trong bảng kiểm tra.</li><li>Xem receipt lịch sử tại mục Bằng chứng để kiểm chứng giao dịch đã có.</li><li>Chưa cần tạo grant, nạp tiền hoặc ký giao dịch để xử lý lỗi AI.</li></ul>
  </div>;
}
export function CopilotExplanation({ answer }: { answer: Answer }) {
  return <div className="near-review" aria-live="polite"><p>LLM: {answer.model} · snapshot FINAL {answer.blockHeight} · <code>{answer.blockHash}</code></p><h4>Kết luận quy tắc của snapshot này: {answer.predicted}</h4><p>{answer.advisory.summary}</p><h4>AI lưu ý</h4><ul>{answer.advisory.risks.map((x, i) => <li key={i}>{x}</li>)}</ul><h4>AI đề xuất kiểm tra</h4><ul>{answer.advisory.nextSteps.map((x, i) => <li key={i}>{x}</li>)}</ul><p className="near-muted">{answer.notice}</p></div>;
}
