import { useRef, useState, type ReactNode } from "react";
import { Activity, ArrowRight, ArrowUpRight, BookOpen, CheckCheck, ChevronRight, CircleHelp, ExternalLink, FlaskConical, LayoutDashboard, LockKeyhole, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import heroArt from "../assets/redline-celestial-vault-hero.webp";
import vaultArt from "../assets/redline-treasury-core.webp";
import guardArt from "../assets/redline-guardrails-citadel.webp";
import proofArt from "../assets/redline-evidence-observatory.webp";
import { available, CONTRACT, near, type Grant, type Ledger } from "./model";

export const workspacePages = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard, description: "Quỹ, quyền và bước tiếp theo của bạn." },
  { id: "vault", label: "Ví & quỹ", icon: Wallet, description: "Kết nối ví và quản lý tiền thử nghiệm trong vault." },
  { id: "permissions", label: "Hạn mức & quyền", icon: ShieldCheck, description: "Bạn duyệt ngân sách. Contract thực thi giới hạn." },
  { id: "lab", label: "Policy Lab", icon: FlaskConical, description: "Thử một đề xuất trên dữ liệu NEAR, trước khi gửi thật." },
  { id: "activity", label: "Hoạt động", icon: Activity, description: "Đối soát kết quả và theo dõi receipt của từng giao dịch." },
  { id: "proofs", label: "Bằng chứng", icon: CheckCheck, description: "Giao dịch Testnet thật, có thể kiểm tra độc lập." },
  { id: "help", label: "Hướng dẫn", icon: CircleHelp, description: "Bắt đầu, khôi phục kết nối và hiểu các trạng thái." },
] as const;
export type WorkspacePage = typeof workspacePages[number]["id"];
export function pageFromHash(hash: string): WorkspacePage {
  if (hash.startsWith("#near-") && hash !== "#near-workspace-content") return pageForTarget(hash.slice(1));
  return workspacePages.find(p => hash === `#/${p.id}`)?.id ?? "overview";
}
export function pageForTarget(target: string): WorkspacePage {
  return ({ "near-owner": "vault", "near-grant": "permissions", "near-policy-lab": "lab", "near-history": "activity", "near-intents": "activity", "near-proofs": "proofs", "near-setup": "help" } as Record<string, WorkspacePage>)[target] ?? "overview";
}
export function StatusBadge({ state }: { state: string }) {
  const tone = ["SETTLED", "CONFIRMED", "PASS", "CONNECTED"].includes(state) ? "success" : ["REJECTED", "REVOKED", "BLOCK"].includes(state) ? "blocked" : ["FAILED", "ERROR"].includes(state) ? "error" : "neutral";
  return <span className={`nw-badge nw-badge-${tone}`}><i aria-hidden="true" />{state}</span>;
}
export function Workspace({ page, navigate, owner, ready, busy, onWallet, children }: { page: WorkspacePage; navigate: (page: WorkspacePage) => void; owner: string; ready: boolean; busy: boolean; onWallet: () => void; children: ReactNode }) {
  const current = workspacePages.find(p => p.id === page)!;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  function selectPage(next: WorkspacePage) { setMenuOpen(false); if (menuOpen && next === page) menuButton.current?.focus(); navigate(next); }
  return <div className="near-app nw-shell">
    <a className="nw-skip" href="#near-workspace-content" onClick={event => { event.preventDefault(); document.getElementById("near-workspace-content")?.focus(); }}>Đến nội dung chính</a>
    <aside className="nw-sidebar" aria-label="Điều hướng NEAR" onKeyDown={event => { if (event.key === "Escape" && menuOpen) { event.preventDefault(); setMenuOpen(false); menuButton.current?.focus(); } }}>
      <div className="nw-sidebar-heading"><button className="nw-brand" onClick={() => selectPage("overview")} aria-label="REDLINE · Tổng quan"><span className="emblem"><ShieldCheck size={20} /></span><span>REDLINE<small>AGENT SECURITY</small></span></button><button ref={menuButton} className="nw-mobile-nav-toggle" aria-expanded={menuOpen} aria-controls="near-primary-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? "Đóng menu" : "Menu"}<ChevronRight size={16} aria-hidden="true" /></button></div>
      <div className="nw-workspace-label"><span className="nw-network-dot" />NEAR WORKSPACE<span>01</span></div>
      <nav id="near-primary-navigation" className={menuOpen ? "is-open" : undefined} aria-label="Các trang NEAR">{workspacePages.map(p => <button key={p.id} aria-current={page === p.id ? "page" : undefined} onClick={() => selectPage(p.id)}><p.icon size={18} /><span>{p.label}</span>{page === p.id && <ChevronRight size={14} />}</button>)}</nav>
      <div className="nw-sidebar-bottom"><div className="nw-safety-note"><LockKeyhole size={18} /><strong>Bạn giữ quyền ký.</strong><p>Agent đề xuất. Quyền do bạn duyệt. Tiền do contract kiểm soát.</p></div><a href="/" target="_blank" rel="noreferrer">Dashboard Solana gốc <ExternalLink size={14} /></a><small>REDLINE for NEAR · Testnet</small></div>
    </aside>
    <div className="nw-stage"><header className="nw-topbar"><div className="nw-breadcrumb">Workspace <ChevronRight size={14} /><strong>{current.label}</strong></div><div className="nw-topbar-tools"><span className={`nw-network ${ready ? "is-ready" : ""}`}><i />NEAR Testnet</span><button className={owner ? "nw-wallet-connected" : "nw-primary"} disabled={busy || (!owner && !ready)} onClick={onWallet}><Wallet size={16} /><span>{owner || "Kết nối ví"}</span>{owner && <i className="nw-network-dot" />}</button></div></header>
      <main id="near-workspace-content" className="nw-content" tabIndex={-1}><div className="nw-page-heading"><div><p className="nw-eyebrow">REDLINE / NEAR</p><h1>{current.label}</h1><p>{current.description}</p></div><span className="nw-environment"><ShieldCheck size={15} />Tài sản thử nghiệm</span></div>{children}<footer className="nw-footer"><span><ShieldCheck size={14} />Quyền có giới hạn. Bằng chứng có thể kiểm tra.</span><a href="https://explorer.testnet.near.org/accounts/nhat-redline-vault.testnet" target="_blank" rel="noreferrer">Contract trên Testnet <ArrowUpRight size={14} /></a></footer></main>
    </div>
  </div>;
}

export function Overview({ owner, grant, balance, ready, hasPending, nextText, nextTarget, navigate, onDemo, demoBlocked }: { owner: string; grant?: Grant; balance?: Ledger; ready: boolean; hasPending: boolean; nextText: string; nextTarget: string; navigate: (p: WorkspacePage) => void; onDemo: () => void; demoBlocked: boolean }) {
  return <div className="nw-overview">
    <section className="nw-hero"><img src={heroArt} alt="" className="nw-hero-art" /><div className="nw-hero-copy"><span className="nw-kicker"><i />AI SECURITY & DEFENSE</span><h2>Agent tự chủ.<br/><em>Giới hạn do bạn.</em></h2><p>Trao ngân sách cho agent, không trao toàn bộ ví.<br/>Mỗi đề xuất đều phải đi qua quyền bạn đã duyệt.</p><div className="nw-hero-actions"><button className="nw-primary" disabled={demoBlocked || !ready} onClick={onDemo}>Khám phá demo đã xác minh <ArrowRight size={16} /></button><button className="nw-light-link" onClick={() => navigate("vault")}>Thiết lập với ví <ArrowUpRight size={16} /></button></div><small>Demo lịch sử · chỉ đọc · không ký hoặc chuyển tiền</small></div><div className="nw-hero-caption"><ShieldCheck size={16} /><span>THE AGENT PROPOSES.<br/><strong>THE CHAIN DECIDES.</strong></span></div></section>
    <div className="nw-metrics">
      <article><div><Wallet size={17} /><span>Khả dụng trong vault</span></div><strong>{balance ? near(available(balance)) : "—"}<small>{balance && "NEAR"}</small></strong><p>{grant ? `Chủ quỹ: ${grant.owner}` : "Đọc snapshot để xem số dư đã xác minh"}</p></article>
      <article><div><ShieldCheck size={17} /><span>Quyền đang xem</span></div><strong className="nw-metric-status">{grant ? !grant.active ? "Đã thu hồi" : BigInt(grant.policy.expires_at_ns) <= BigInt(Date.now()) * 1000000n ? "Đã hết hạn" : "Đang hiệu lực" : "Chưa tải"}</strong><p>{grant ? "Theo snapshot đã đọc · làm mới để đối chiếu" : "Không tự tạo hoặc gia hạn quyền"}</p></article>
      <article><div><Activity size={17} /><span>Tiền đang giữ chỗ</span></div><strong>{balance ? near(balance.pending_reserved) : "—"}<small>{balance && "NEAR"}</small></strong><p>Chờ callback · không giải phóng bằng timeout</p></article>
    </div>
    <section className="nw-next-step"><div className="nw-next-icon"><Sparkles size={22} /></div><div><span className="nw-eyebrow">{hasPending ? "CẦN ĐỐI SOÁT" : "BƯỚC TIẾP THEO"}</span><h3>{!ready ? "Kết nối API để bắt đầu" : hasPending ? "Tiếp tục thao tác đang lưu" : owner ? "Tiếp tục workspace của bạn" : "Khám phá trước khi kết nối ví"}</h3><p>{!owner && !hasPending && ready ? "Xem receipt và thử Policy Lab trên grant demo đã thu hồi. Bạn chưa cần ví hay token." : nextText}</p></div><button onClick={() => navigate(!owner && !hasPending && ready ? "proofs" : pageForTarget(nextTarget))}>Tiếp tục <ArrowRight size={16} /></button></section>
    <div className="nw-section-heading"><div><span className="nw-eyebrow">YOUR CONTROL CENTER</span><h2>Một workspace. Ba lớp kiểm soát.</h2></div><span>Ví ký · Contract kiểm tra · Receipt xác nhận</span></div>
    <div className="nw-worlds">{[
      { title: "Quỹ của bạn", eyebrow: "THE VAULT", text: "Số dư ví, principal và phí lưu trữ được tách riêng. Từng khoản nạp đều cần bạn duyệt.", image: vaultArt, page: "vault" as const, icon: Wallet },
      { title: "Ranh giới của agent", eyebrow: "THE CITADEL", text: "Ngân sách, người nhận và thời hạn. Phân tích đề xuất trước khi cho phép thực thi.", image: guardArt, page: "lab" as const, icon: ShieldCheck },
      { title: "Bằng chứng thực thi", eyebrow: "THE OBSERVATORY", text: "Theo dấu ALLOW và REJECT tới receipt Testnet thật. Không đánh đồng gửi với thành công.", image: proofArt, page: "proofs" as const, icon: BookOpen },
    ].map(card => <button className="nw-world" key={card.page} onClick={() => navigate(card.page)}><div className="nw-world-art"><img src={card.image} alt="" loading="lazy" /><span><card.icon size={18} /></span></div><div className="nw-world-copy"><small>{card.eyebrow}</small><h3>{card.title}<ArrowUpRight size={19} /></h3><p>{card.text}</p></div></button>)}</div>
    <div className="nw-contract-strip"><span><LockKeyhole size={15} />Native NEAR · Testnet</span><code>{CONTRACT}</code><button onClick={() => navigate("help")}>Hiểu cách hoạt động <ArrowRight size={14} /></button></div>
  </div>;
}
