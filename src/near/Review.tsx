import { ArrowRight, FileCheck2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { near, type Proposal } from "./model";
export function ProposalReview({ proposal, busy, blocked, onSign, onCancel }: { proposal: Proposal; busy: boolean; blocked: boolean; onSign: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.focus(); return () => previous?.focus(); }, []);
  function keys(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),summary') ?? []);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
  }
  const action = proposal.transaction.actions[0].params;
  const name = ({ storage_deposit: "Đăng ký phí lưu trữ", deposit: "Nạp tiền vào quỹ", create_grant: "Cấp quyền cho agent", revoke_grant: "Thu hồi quyền agent" } as Record<string, string>)[action.methodName] ?? action.methodName;
  const policy = action.methodName === "create_grant" ? action.args.policy as { spend_cap: string; recipients: string[]; expires_at_ns: string; max_transactions: number } : undefined;
  return <aside ref={dialog} tabIndex={-1} onKeyDown={keys} role="dialog" aria-modal="true" className="near-review nw-proposal-review" aria-labelledby="nw-review-title"><div className="nw-section-heading"><div><span className="nw-eyebrow"><FileCheck2 size={13} /> XEM LẠI TRƯỚC KHI KÝ</span><h3 id="nw-review-title">{name}</h3></div><span><ShieldCheck size={14} />NEAR Testnet</span></div><dl className="nw-review-facts"><div><dt>Ví ký</dt><dd>{proposal.signerId}</dd></div><div><dt>Contract nhận</dt><dd>{proposal.transaction.receiverId}</dd></div><div><dt>Khoản gửi kèm</dt><dd>{near(action.deposit)} NEAR <small>+ phí gas</small></dd></div>{policy && <><div><dt>Ngân sách tối đa</dt><dd>{near(policy.spend_cap)} NEAR · {policy.max_transactions} lượt</dd></div><div><dt>Chỉ thanh toán cho</dt><dd>{policy.recipients.join(", ")}</dd></div><div><dt>Hết quyền lúc (UTC+7)</dt><dd>{new Date(Number(BigInt(policy.expires_at_ns) / 1000000n)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</dd></div></>}</dl>
    <p>{policy ? "Thời hạn tính từ lúc chuẩn bị. Đăng nhập lại không gia hạn quyền." : action.methodName === "revoke_grant" ? "Thu hồi chặn yêu cầu mới. Giao dịch đã dispatch vẫn cần đợi callback." : "Đây là token Testnet. Chỉ ký một lần; nếu kết quả chưa rõ, dùng đối soát thay vì nạp lại."}</p>
    <details className="nw-json"><summary>Xem JSON giao dịch</summary><pre>{JSON.stringify(proposal, null, 2)}</pre></details>
    <div className="nw-review-actions"><button className="nw-primary" disabled={busy || blocked} onClick={onSign}>Tôi đã xem · Mở ví ký Testnet <ArrowRight size={15} /></button><button disabled={busy} onClick={onCancel}>Hủy đề xuất</button></div><small>Ví sẽ yêu cầu bạn xác nhận riêng. Màn hình này chưa ký hoặc gửi giao dịch.</small>
  </aside>;
}
