import { useState } from "react";
import { api } from "./api";
import { CAP, CONTRACT, PAYEE, near } from "./model";
import { parsePending, type IntentRequest } from "./pending";

export function parseLabAmount(value: string): string {
  if (value.length > 65 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,24})?$/.test(value)) throw Error("Nhập NEAR dạng thập phân, tối đa 24 chữ số sau dấu chấm.");
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, "0"));
  if (units >= 1n << 128n) throw Error("Số tiền vượt u128.");
  return units.toString();
}
type Report = { network: string; contractId: string; grantId: string; owner: string; blockHeight: number; blockHash: string; predicted: string; notice: string;
  candidate: { grantId: string; amount: string; recipient: string; nonce: string; asset: string; policyHash: string; intentId?: string };
  grant: { next_nonce: string; policy: { policy_hash: string; spend_cap: string } };
  ledger: { credited: string; finalized_spent: string; pending_reserved: string; completed_withdrawals: string; pending_withdrawals: string }; gates: { reason: string; status: string; explanation: string }[] };

export function labHandoff(report: Report, owner: string, grantId: string): IntentRequest {
  const c = report.candidate;
  if (report.network !== "testnet" || report.contractId !== CONTRACT || report.owner !== owner || !owner || report.grantId !== grantId || c.grantId !== grantId || report.predicted !== "ALLOW" || c.intentId || c.asset !== "NEAR" || c.recipient !== PAYEE || BigInt(c.amount) > BigInt(CAP) || c.nonce !== report.grant.next_nonce || c.policyHash !== report.grant.policy.policy_hash) throw Error("Chỉ chuyển đề xuất ALLOW của đúng chủ grant vào bước xem lại.");
  return parsePending({ grant_id: grantId, intent_id: `lab-${crypto.randomUUID().replaceAll("-", "")}`, nonce: c.nonce, asset: c.asset, recipient: c.recipient, amount: c.amount, policy_hash: c.policyHash });
}

export function NearPolicyLab({ grantId, owner, nonce, policyHash, disabled, reviewBlocked = false, onReview }: { grantId: string; owner: string; nonce: string; policyHash: string; disabled: boolean; reviewBlocked?: boolean; onReview: (request: IntentRequest) => void }) {
  const [amount, setAmount] = useState("0.01"), [recipient, setRecipient] = useState(PAYEE), [candidateNonce, setNonce] = useState(nonce), [intentId, setIntentId] = useState("");
  const [report, setReport] = useState<Report>(), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  function change(fn: () => void) { fn(); setReport(undefined); setError(""); }
  async function analyze() {
    setReport(undefined); setError(""); setLoading(true);
    try {
      const result = await api<Report>("/near/policy-lab/analyze", { grantId, amount: parseLabAmount(amount), recipient, nonce: candidateNonce, asset: "NEAR", policyHash, ...(intentId ? { intentId } : {}) });
      if (result.network !== "testnet" || result.contractId !== CONTRACT || result.grantId !== grantId) throw Error("Snapshot không khớp NEAR Testnet.");
      setReport(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa phân tích được."); } finally { setLoading(false); }
  }
  return <section id="near-policy-lab"><h2>Policy Lab / Copilot NEAR</h2><p>Phân tích bằng quy tắc từ dữ liệu chain ở cùng một block FINAL. Không cần đăng nhập để mô phỏng; không ký, không tốn gas. Không phải phản hồi từ LLM.</p>
    <p>Grant: <code>{grantId}</code></p>
    {reviewBlocked && <p>Có request hoặc đề xuất đang giữ. Bạn vẫn phân tích chỉ đọc được; chưa tạo intent mới cho đến khi đối soát hoặc hoàn tất thao tác hiện tại.</p>}
    <fieldset disabled={disabled || loading}><label>Số NEAR cần mô phỏng<input inputMode="decimal" maxLength={65} value={amount} onChange={e => change(() => setAmount(e.target.value))} /></label>
    <label>Người nhận<input maxLength={64} value={recipient} onChange={e => change(() => setRecipient(e.target.value))} /></label>
    <label>Nonce<input maxLength={20} value={candidateNonce} onChange={e => change(() => setNonce(e.target.value))} /></label>
    <label>Intent ID cũ (tùy chọn, kiểm tra trùng)<input maxLength={64} value={intentId} onChange={e => change(() => setIntentId(e.target.value))} /></label>
    <button onClick={() => void analyze()}>{loading ? "Đang đọc snapshot…" : "Phân tích · chỉ đọc"}</button></fieldset>
    {error && <p role="alert" className="near-error">{error}</p>}
    {report && <div className="near-review"><h3>Dự đoán: {report.predicted}</h3><p>FINAL block {report.blockHeight} · <code>{report.blockHash}</code></p>
      <p>Đề xuất {near(report.candidate.amount)} NEAR. Tiền đang giữ chỗ: {near(report.ledger.pending_reserved)} NEAR.</p>
      <table><thead><tr><th>Kiểm tra</th><th>Kết quả mô phỏng</th><th>Copilot giải thích</th></tr></thead><tbody>{report.gates.map(g => <tr key={g.reason}><td>{g.reason}</td><td>{g.status}</td><td>{g.explanation}</td></tr>)}</tbody></table>
      <p>{report.notice}</p><p>{report.predicted === "REVOKED" ? "Grant đã thu hồi. Có thể tiếp tục xem bằng chứng; quyền mới phải do chủ ví duyệt và ký riêng." : report.predicted === "EXPIRED" ? "Grant đã hết hạn. Đăng nhập lại không gia hạn quyền; tạo quyền mới cần chữ ký riêng." : report.predicted === "ALLOW" ? "Các điều kiện mô phỏng đều qua. Chuyển sang xem lại nếu muốn gửi thật; callback mới quyết định SETTLED." : "Đề xuất sẽ bị chặn theo snapshot. Kiểm tra gate BLOCK, không tự mở rộng cap hoặc đổi quyền."}</p>
      <button disabled={disabled || reviewBlocked || loading || !owner || report.owner !== owner || report.predicted !== "ALLOW" || !!intentId} onClick={() => { try { if (reviewBlocked) throw Error("Hoàn tất thao tác hiện tại trước khi tạo intent mới."); onReview(labHandoff(report, owner, grantId)); setReport(undefined); } catch (e) { setError((e as Error).message); } }}>Chuyển sang xem lại intent · chưa gửi</button>
    </div>}
  </section>;
}
