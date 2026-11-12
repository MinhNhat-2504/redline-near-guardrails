import { useState } from "react";
import { ArrowUpRight, CheckCheck, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { explorerUrl } from "./onboarding";
import { StatusBadge } from "./Workspace";
export const browserProofs = [
  { label: "Đăng ký lưu trữ", detail: "Chủ ví đăng ký 0,05 NEAR cho lưu trữ.", state: "CONFIRMED", group: "owner", hash: "3HWgnSzk6Zo1Q87zaoKYLjvqTnbKYbNHEqmRD13Ud14Z" },
  { label: "Nạp tiền chi tiêu", detail: "0,1 NEAR được ghi nhận vào quỹ của chủ ví.", state: "CONFIRMED", group: "owner", hash: "7F4EigWDUF8X8TNQcqhQ4m8H8h7syNV8MdEt8vKKzS3x" },
  { label: "Cấp quyền có giới hạn", detail: "Ngân sách 0,05 NEAR, tối đa 3 lượt, một người nhận.", state: "CONFIRMED", group: "owner", hash: "7UKKxLJyiFJLiBLr92CRbe8gP21czuv5ru8Du9bWXLM3" },
  { label: "Chuyển hợp lệ 0,01 NEAR", detail: "Callback đã xác nhận khoản chuyển hợp lệ.", state: "SETTLED", group: "allow", hash: "6dQsYKnAqx3y5bQYwSHD3LeVktSpMiKSnX9LLV6VRZoe" },
  { label: "Chặn vượt ngân sách", detail: "SPEND_CAP_EXCEEDED · tiền gốc không bị chuyển.", state: "REJECTED", group: "reject", hash: "CX71RxEViVW2xrVxQBtELiPNic8NwCMchoxwxhvfymtX" },
  { label: "Chặn sai người nhận", detail: "DESTINATION_NOT_ALLOWED · ngoài danh sách được phép.", state: "REJECTED", group: "reject", hash: "GympRgkPjYkNLa6NTDp6eaALgh5hTiHnhNi6T7PYJ5pX" },
  { label: "Chặn yêu cầu phát lại", detail: "NONCE_REPLAY · không thanh toán lại nonce đã dùng.", state: "REJECTED", group: "reject", hash: "9LdgMWE3aE7PJ3vHa9veApZ6yFdRstVfwKRPdS9fdV1w" },
  { label: "Chủ ví thu hồi quyền", detail: "Grant trở về active:false, chặn yêu cầu mới.", state: "CONFIRMED", group: "owner", hash: "2XojCUvx1QLkA1tsPKS4AM8tacjQjp3Ubv6ZJLFcfJVd" },
  { label: "Chặn sau thu hồi", detail: "REVOKED · agent không thể tiếp tục chi.", state: "REJECTED", group: "reject", hash: "FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP" },
] as const;
export function ProofGallery() {
  const [filter, setFilter] = useState("all");
  return <section id="near-proofs"><DemoWalkthrough /><div className="nw-section-heading"><div><span className="nw-eyebrow">KIỂM CHỨNG TỪNG BƯỚC</span><h2>Giao dịch gốc của demo</h2></div><span><CheckCheck size={15} />9 giao dịch lịch sử</span></div><p className="near-muted">Receipt FINAL đã được đối chiếu độc lập. Đây là demo do chủ dự án thao tác qua trình duyệt, không phải kiểm thử trình duyệt tự động hay trạng thái hiện tại của một yêu cầu mới.</p>
    <div className="nw-proof-filters" aria-label="Lọc bằng chứng">{[["all", "Tất cả"], ["allow", "Đã thanh toán"], ["reject", "Đã chặn"], ["owner", "Thao tác chủ ví"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <div className="nw-proof-grid">{browserProofs.filter(p => filter === "all" || p.group === filter).map((proof, index) => <a className="nw-proof-card" key={proof.hash} href={explorerUrl(proof.hash)} target="_blank" rel="noreferrer"><div><span className="nw-proof-number">{String(index + 1).padStart(2, "0")}</span><StatusBadge state={proof.state} /><ArrowUpRight size={16} /></div><h3>{proof.label}</h3><p>{proof.detail}</p><small><ExternalLink size={12} />Xem giao dịch gốc</small></a>)}</div>
    <div className="nw-proof-footer"><ShieldCheck size={18} /><p>Rejected là contract từ chối yêu cầu, không phải khoản chuyển tiền thành công. Chỉ SETTLED mới biểu thị callback đã xác nhận chuyển tiền.</p><LockKeyhole size={16} /></div>
  </section>;
}

export const demoCases = [
  { name: "Chi đúng quyền", proofIndex: 3, request: "Trả 0,01 NEAR cho người nhận đã duyệt.", result: "Đã chuyển 0,01 NEAR", explanation: "Khoản chi nằm trong ngân sách 0,05 NEAR. Hợp đồng cho phép chuyển và đã xác nhận kết quả.", blocked: false },
  { name: "Vượt ngân sách", proofIndex: 4, request: "Chi thêm vượt tổng ngân sách đã cấp.", result: "Bị chặn: vượt ngân sách", explanation: "Quyền vẫn còn nhưng số tiền vượt giới hạn. Yêu cầu này không chuyển tiền gốc cho người nhận.", blocked: true },
  { name: "Sai người nhận", proofIndex: 5, request: "Trả tiền tới tài khoản ngoài danh sách đã duyệt.", result: "Bị chặn: sai người nhận", explanation: "Số tiền nhỏ cũng không được đi tới tài khoản ngoài danh sách. Hợp đồng chặn yêu cầu này.", blocked: true },
  { name: "Đã thu hồi quyền", proofIndex: 8, request: "Tiếp tục chi sau khi chủ ví thu hồi quyền.", result: "Bị chặn: quyền đã thu hồi", explanation: "Chủ ví đã dừng quyền chi tiêu. Yêu cầu mới bị chặn dù ngân sách cũ vẫn còn.", blocked: true },
] as const;

export const englishDemoCases = [
  { name: "Within permission", request: "Pay 0.01 NEAR to the approved recipient.", result: "0.01 NEAR transferred", explanation: "The payment fits the 0.05 NEAR budget. The contract allowed it and its callback confirmed settlement." },
  { name: "Over budget", request: "Request spending that exceeds the total approved budget.", result: "Blocked: budget exceeded", explanation: "Permission still exists, but the amount exceeds its limit. This request did not transfer principal to the recipient." },
  { name: "Wrong recipient", request: "Pay an account outside the approved recipient list.", result: "Blocked: recipient not allowed", explanation: "Even a small amount cannot go to an unapproved account. The contract rejected this request." },
  { name: "Permission revoked", request: "Request another payment after the owner revoked permission.", result: "Blocked: permission revoked", explanation: "The owner stopped new spending. The request was rejected even though unused budget remained." },
] as const;

export function DemoWalkthrough() {
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  return <div><div className="nw-language-choice" role="group" aria-label="Ngôn ngữ demo / Demo language"><span>Demo language</span><button lang="vi" aria-pressed={language === "vi"} onClick={() => setLanguage("vi")}>Tiếng Việt</button><button lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button></div><DemoCaseContent selected={selected} language={language} onSelect={setSelected} /></div>;
}

export function DemoCaseContent({ selected, language, onSelect }: { selected: number; language: "vi" | "en"; onSelect: (index: number) => void }) {
  const index = Number.isInteger(selected) && selected >= 0 && selected < demoCases.length ? selected : 0;
  const en = language === "en", source = demoCases[index], item = en ? englishDemoCases[index] : source;
  const proof = browserProofs[source.proofIndex], choices = en ? englishDemoCases : demoCases;
  return <div className="nw-demo-tour" lang={language} aria-labelledby="near-demo-title"><span className="nw-eyebrow">{en ? "VERIFIABLE DEMO · READ ONLY" : "DEMO CÓ THỂ KIỂM CHỨNG · CHỈ XEM"}</span><h2 id="near-demo-title">{en ? "What happens when an AI assistant asks to spend?" : "Nếu trợ lý AI yêu cầu chi tiền, điều gì xảy ra?"}</h2><p>{en ? <>The owner granted a <strong>0.05 NEAR</strong> budget, at most <strong>3 payments</strong>, only to <code>nhat-redline-payee.testnet</code>. Choose a historical case to inspect its recorded outcome.</> : <>Trong demo này, chủ ví đã cấp <strong>0,05 NEAR</strong>, tối đa <strong>3 lần</strong>, chỉ trả cho <code>nhat-redline-payee.testnet</code>. Chọn từng tình huống để xem kết quả đã ghi nhận.</>}</p><div className="nw-demo-choices" role="group" aria-label={en ? "Choose a demo case" : "Chọn tình huống demo"}>{choices.map((entry, choice) => <button key={choice} aria-pressed={index === choice} aria-controls="near-demo-result" onClick={() => onSelect(choice)}><span>{choice + 1}</span>{entry.name}</button>)}</div><article id="near-demo-result" className={`nw-demo-result ${source.blocked ? "is-blocked" : "is-allowed"}`} aria-live="polite" aria-atomic="true"><div><span className="nw-eyebrow">{en ? "REQUEST IN THIS DEMO" : "YÊU CẦU TRONG DEMO"}</span><p>{item.request}</p></div><div>{en ? <span className={`nw-badge ${source.blocked ? "nw-badge-blocked" : "nw-badge-success"}`}><i aria-hidden="true" />{source.blocked ? "Blocked" : "Payment settled"}<small className="nw-state-code">{proof.state}</small></span> : <StatusBadge state={proof.state} />}<h3>{item.result}</h3><p>{item.explanation}</p><a href={explorerUrl(proof.hash)} target="_blank" rel="noreferrer">{en ? "Inspect this transaction on NEAR Explorer" : "Kiểm tra giao dịch này trên NEAR Explorer"} <ArrowUpRight size={15} /></a></div></article><p className="near-muted">{en ? "These are historical Testnet transactions, not a fresh simulation or a newly submitted payment. Choosing a case does not sign, call an AI model or move funds. Rejected transactions may still incur execution fees." : "Các kết quả trên là giao dịch Testnet lịch sử, không phải mô phỏng mới hay giao dịch vừa gửi. Chọn tình huống không ký, không gọi AI và không chuyển tiền. Giao dịch bị chặn vẫn có thể tốn phí thực thi."}</p>{en && <details><summary>What is implemented, and why NEAR?</summary><p>REDLINE constrains an executor account using a FunctionCall key and an owner-approved policy in a NEAR contract. The vault reserves funds before dispatch and finalizes accounting through a private callback. Revocation blocks new requests; it does not cancel a transfer already dispatched.</p><p>The payment scenarios use controlled JSON requests. Optional Gemini explanations cannot sign, create permissions or override the contract. This demo does not claim autonomous service purchases, Mainnet readiness or an independent security audit.</p><a href="https://github.com/MinhNhat-2504/redline-near-guardrails" target="_blank" rel="noreferrer">Source, reproduction instructions and full evidence</a></details>}</div>;
}
