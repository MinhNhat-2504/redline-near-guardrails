import { useState } from "react";
import { ArrowUpRight, CheckCheck, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { explorerUrl } from "./onboarding";
import { StatusBadge } from "./Workspace";
export const browserProofs = [
  { label: "Đăng ký storage", detail: "Chủ ví đăng ký 0,05 NEAR cho lưu trữ.", state: "CONFIRMED", group: "owner", hash: "3HWgnSzk6Zo1Q87zaoKYLjvqTnbKYbNHEqmRD13Ud14Z" },
  { label: "Nạp principal", detail: "0,1 NEAR được ghi nhận vào quỹ của chủ ví.", state: "CONFIRMED", group: "owner", hash: "7F4EigWDUF8X8TNQcqhQ4m8H8h7syNV8MdEt8vKKzS3x" },
  { label: "Cấp quyền có giới hạn", detail: "Ngân sách 0,05 NEAR, tối đa 3 lượt, một người nhận.", state: "CONFIRMED", group: "owner", hash: "7UKKxLJyiFJLiBLr92CRbe8gP21czuv5ru8Du9bWXLM3" },
  { label: "ALLOW · chuyển 0,01 NEAR", detail: "Callback đã xác nhận khoản chuyển hợp lệ.", state: "SETTLED", group: "allow", hash: "6dQsYKnAqx3y5bQYwSHD3LeVktSpMiKSnX9LLV6VRZoe" },
  { label: "Chặn vượt ngân sách", detail: "SPEND_CAP_EXCEEDED · tiền gốc không bị chuyển.", state: "REJECTED", group: "reject", hash: "CX71RxEViVW2xrVxQBtELiPNic8NwCMchoxwxhvfymtX" },
  { label: "Chặn sai người nhận", detail: "DESTINATION_NOT_ALLOWED · ngoài allowlist.", state: "REJECTED", group: "reject", hash: "GympRgkPjYkNLa6NTDp6eaALgh5hTiHnhNi6T7PYJ5pX" },
  { label: "Chặn nonce phát lại", detail: "NONCE_REPLAY · không thanh toán lại nonce đã dùng.", state: "REJECTED", group: "reject", hash: "9LdgMWE3aE7PJ3vHa9veApZ6yFdRstVfwKRPdS9fdV1w" },
  { label: "Chủ ví thu hồi quyền", detail: "Grant trở về active:false, chặn yêu cầu mới.", state: "CONFIRMED", group: "owner", hash: "2XojCUvx1QLkA1tsPKS4AM8tacjQjp3Ubv6ZJLFcfJVd" },
  { label: "Chặn sau thu hồi", detail: "REVOKED · agent không thể tiếp tục chi.", state: "REJECTED", group: "reject", hash: "FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP" },
] as const;
export function ProofGallery() {
  const [filter, setFilter] = useState("all");
  return <section id="near-proofs"><div className="nw-section-heading"><div><span className="nw-eyebrow">VERIFIED TESTNET WALKTHROUGH</span><h2>Từ cấp quyền đến bằng chứng thực thi.</h2></div><span><CheckCheck size={15} />9 giao dịch lịch sử</span></div><p className="near-muted">Receipt FINAL đã được đối chiếu độc lập. Đây là demo do chủ dự án thao tác qua trình duyệt, không phải kiểm thử trình duyệt tự động hay trạng thái hiện tại của một yêu cầu mới.</p>
    <div className="nw-proof-filters" aria-label="Lọc bằng chứng">{[["all", "Tất cả"], ["allow", "Đã thanh toán"], ["reject", "Đã chặn"], ["owner", "Thao tác chủ ví"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <div className="nw-proof-grid">{browserProofs.filter(p => filter === "all" || p.group === filter).map((proof, index) => <a className="nw-proof-card" key={proof.hash} href={explorerUrl(proof.hash)} target="_blank" rel="noreferrer"><div><span className="nw-proof-number">{String(index + 1).padStart(2, "0")}</span><StatusBadge state={proof.state} /><ArrowUpRight size={16} /></div><h3>{proof.label}</h3><p>{proof.detail}</p><small><ExternalLink size={12} />Mở receipt Testnet</small></a>)}</div>
    <div className="nw-proof-footer"><ShieldCheck size={18} /><p>Rejected là contract từ chối yêu cầu, không phải khoản chuyển tiền thành công. Chỉ SETTLED mới biểu thị callback đã xác nhận chuyển tiền.</p><LockKeyhole size={16} /></div>
  </section>;
}
