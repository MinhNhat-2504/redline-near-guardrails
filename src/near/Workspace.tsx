import { useRef, useState, type ReactNode } from "react";
import { Activity, ArrowRight, ArrowUpRight, BookOpen, CheckCheck, ChevronRight, CircleHelp, ExternalLink, FlaskConical, LayoutDashboard, LockKeyhole, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import heroArt from "../assets/redline-celestial-vault-hero.webp";
import vaultArt from "../assets/redline-treasury-core.webp";
import guardArt from "../assets/redline-guardrails-citadel.webp";
import proofArt from "../assets/redline-evidence-observatory.webp";
import { available, CONTRACT, near, type Grant, type Ledger } from "./model";
import { stateLabels } from "./product-copy";

export const workspacePages = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard, description: "Giới hạn chi tiêu cho trợ lý AI, với quyền quyết định thuộc về bạn." },
  { id: "vault", label: "Ví & quỹ", icon: Wallet, description: "Nạp, theo dõi và rút tiền thử nghiệm trong quỹ riêng của bạn." },
  { id: "permissions", label: "Hạn mức & quyền", icon: ShieldCheck, description: "Bạn chọn ngân sách, người nhận và thời hạn. Hợp đồng kiểm tra từng khoản chi." },
  { id: "lab", label: "Kiểm tra đề xuất", icon: FlaskConical, description: "Kiểm tra số tiền và người nhận trước khi quyết định gửi giao dịch." },
  { id: "activity", label: "Hoạt động", icon: Activity, description: "Xem khoản nào đã chuyển, khoản nào bị chặn và kiểm tra kết quả." },
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
  return <span className={`nw-badge nw-badge-${tone}`}><i aria-hidden="true" />{stateLabels[state] ?? state}{stateLabels[state] && <small className="nw-state-code">{state}</small>}</span>;
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
      <div className="nw-sidebar-bottom"><div className="nw-safety-note"><LockKeyhole size={18} /><strong>Bạn giữ quyền ký.</strong><p>Bạn chọn ngân sách và người nhận. Hợp đồng kiểm tra từng yêu cầu chi.</p></div><a href="/" target="_blank" rel="noreferrer">Dashboard Solana gốc <ExternalLink size={14} /></a><small>REDLINE for NEAR · Testnet</small></div>
    </aside>
    <div className="nw-stage"><header className="nw-topbar"><div className="nw-breadcrumb">REDLINE <ChevronRight size={14} /><strong>{current.label}</strong></div><div className="nw-topbar-tools"><span className={`nw-network ${ready ? "is-ready" : ""}`}><i />NEAR Testnet</span><button className={owner ? "nw-wallet-connected" : "nw-primary"} disabled={busy || (!owner && !ready)} onClick={onWallet}><Wallet size={16} /><span>{owner || "Kết nối ví"}</span>{owner && <i className="nw-network-dot" />}</button></div></header>
      <main id="near-workspace-content" className="nw-content" tabIndex={-1}><div className="nw-page-heading"><div><p className="nw-eyebrow">REDLINE / NEAR</p><h1>{current.label}</h1><p>{current.description}</p></div><span className="nw-environment"><ShieldCheck size={15} />Tài sản thử nghiệm</span></div>{children}<footer className="nw-footer"><span><ShieldCheck size={14} />Quyền có giới hạn. Bằng chứng có thể kiểm tra.</span><a href="https://explorer.testnet.near.org/accounts/nhat-redline-vault.testnet" target="_blank" rel="noreferrer">Contract trên Testnet <ArrowUpRight size={14} /></a></footer></main>
    </div>
  </div>;
}

export function Overview({ owner, grant, balance, ready, hasPending, nextText, nextTarget, navigate }: { owner: string; grant?: Grant; balance?: Ledger; ready: boolean; hasPending: boolean; nextText: string; nextTarget: string; navigate: (p: WorkspacePage) => void; onDemo: () => void; demoBlocked: boolean }) {
  return <div className="nw-overview">
    <section className="nw-hero nw-product-hero"><img src={heroArt} alt="" className="nw-hero-art" /><div className="nw-hero-copy"><span className="nw-kicker"><i />KIỂM SOÁT CHI TIÊU CỦA TRỢ LÝ AI</span><h2>Cho AI ngân sách.<br/><em>Bạn giữ quyền quyết định.</em></h2><p>REDLINE giúp bạn đặt giới hạn khi giao tiền cho trợ lý AI: được chi bao nhiêu, trả cho ai và trong bao lâu. Hợp đồng trên NEAR kiểm tra từng yêu cầu trước khi chuyển tiền.</p><div className="nw-hero-actions"><button className="nw-primary" onClick={() => navigate("proofs")}>Xem demo: được phép hay bị chặn? <ArrowRight size={16} /></button><button className="nw-light-link" onClick={() => navigate("vault")}>Tự thử với ví Testnet <ArrowUpRight size={16} /></button></div><small>Xem demo không cần ví · không ký hoặc chuyển tiền · dùng giao dịch lịch sử</small></div></section>
    <section className="nw-use-case" aria-labelledby="near-purpose"><div><span className="nw-eyebrow">DÙNG KHI NÀO?</span><h2 id="near-purpose">Bạn muốn AI trả tiền hộ, nhưng trong giới hạn.</h2><p>Ví dụ: một trợ lý tự động thanh toán dịch vụ cho bạn. Bạn chỉ cho phép trả tới một tài khoản, trong một ngân sách và thời hạn cụ thể. Nếu trợ lý đề xuất sai, hợp đồng sẽ chặn yêu cầu vi phạm.</p><small>Đây là tình huống sử dụng minh họa. Bản hiện tại kiểm thử đề xuất có kiểm soát trên Testnet; chưa có trợ lý tự mua dịch vụ.</small></div><ol className="nw-steps"><li><span>01</span><div><strong>Bạn đặt giới hạn</strong><p>Ngân sách, người nhận, số lượt và thời hạn.</p></div></li><li><span>02</span><div><strong>Hợp đồng kiểm tra</strong><p>Đề xuất phải nằm trong quyền bạn đã ký.</p></div></li><li><span>03</span><div><strong>Bạn kiểm chứng kết quả</strong><p>Xem giao dịch đã chuyển hoặc lý do bị chặn. Thu hồi quyền khi cần.</p></div></li></ol></section>
    <div className="nw-section-heading"><div><span className="nw-eyebrow">BẮT ĐẦU TỪ ĐÂY</span><h2>Bạn muốn tìm hiểu hay tự thử?</h2></div></div>
    <div className="nw-start-options"><article><span className="nw-path-tag">NÊN BẮT ĐẦU Ở ĐÂY</span><h3>Hiểu sản phẩm qua demo</h3><p>Xem một khoản 0,01 NEAR đã chuyển thành công, rồi xem các yêu cầu bị chặn vì vượt ngân sách, sai người nhận hoặc quyền đã bị thu hồi.</p><button className="nw-primary" onClick={() => navigate("proofs")}>Xem demo có bằng chứng <ArrowRight size={16} /></button><small>Không cần đăng nhập hoặc kết nối API để mở link bằng chứng.</small></article><article><span className="nw-eyebrow">THAO TÁC VỚI VÍ CỦA BẠN</span><h3>Tự thử trên mạng thử nghiệm</h3><p>Kết nối ví, đọc quỹ, duyệt quyền rồi thử một yêu cầu. Mỗi bước có màn hình xem lại; các giao dịch của chủ ví cần chữ ký riêng.</p><button onClick={() => navigate(hasPending ? pageForTarget(nextTarget) : "vault")}>{hasPending ? "Tiếp tục thao tác đang lưu" : "Bắt đầu với ví Testnet"}<ArrowRight size={16} /></button><small>Chỉ dùng NEAR Testnet. Không dùng tiền thật.</small></article></div>
    <details className="nw-workspace-details" open={hasPending || !!owner}><summary>Quỹ đang xem và thao tác cần tiếp tục</summary>
    <div className="nw-metrics">
      <article><div><Wallet size={17} /><span>Tiền khả dụng trong quỹ đang xem</span></div><strong>{balance ? near(available(balance)) : "—"}<small>{balance && "NEAR"}</small></strong><p>{grant ? `Chủ quỹ: ${grant.owner}` : "Chưa đọc số dư · mở Ví & quỹ để kiểm tra"}</p></article>
      <article><div><ShieldCheck size={17} /><span>Quyền đang xem</span></div><strong className="nw-metric-status">{grant ? !grant.active ? "Đã thu hồi" : BigInt(grant.policy.expires_at_ns) <= BigInt(Date.now()) * 1000000n ? "Đã hết hạn" : "Đang hiệu lực" : "Chưa tải"}</strong><p>{grant ? "Theo snapshot đã đọc · làm mới để đối chiếu" : "Không tự tạo hoặc gia hạn quyền"}</p></article>
      <article><div><Activity size={17} /><span>Tiền đang giữ chỗ</span></div><strong>{balance ? near(balance.pending_reserved) : "—"}<small>{balance && "NEAR"}</small></strong><p>Đang chờ hợp đồng xác nhận kết quả chuyển tiền</p></article>
    </div>
    <section className="nw-next-step"><div className="nw-next-icon"><Sparkles size={22} /></div><div><span className="nw-eyebrow">{hasPending ? "CẦN ĐỐI SOÁT" : "BƯỚC TIẾP THEO"}</span><h3>{!ready ? "Kết nối API để bắt đầu" : hasPending ? "Tiếp tục thao tác đang lưu" : owner ? "Tiếp tục việc bạn đang làm" : "Khám phá trước khi kết nối ví"}</h3><p>{!owner && !hasPending && ready ? "Xem khoản đã chuyển và yêu cầu bị chặn trong demo lịch sử. Bạn chưa cần ví hay token." : nextText}</p></div><button onClick={() => navigate(!owner && !hasPending && ready ? "proofs" : pageForTarget(nextTarget))}>Tiếp tục <ArrowRight size={16} /></button></section>
    <div className="nw-section-heading"><div><span className="nw-eyebrow">ĐIỀU HƯỚNG NHANH</span><h2>Mỗi việc có một nơi rõ ràng.</h2></div><span>Bạn duyệt · Hợp đồng kiểm tra · Giao dịch xác nhận</span></div>
    <div className="nw-worlds">{[
      { title: "Quỹ của bạn", eyebrow: "VÍ & QUỸ", text: "Xem tiền được phép chi, phí lưu trữ riêng và rút phần khả dụng về ví của bạn.", image: vaultArt, page: "vault" as const, icon: Wallet },
      { title: "Ranh giới của agent", eyebrow: "KIỂM TRA ĐỀ XUẤT", text: "Ngân sách, người nhận và thời hạn. Phân tích đề xuất trước khi cho phép thực thi.", image: guardArt, page: "lab" as const, icon: ShieldCheck },
      { title: "Bằng chứng thực thi", eyebrow: "GIAO DỊCH LỊCH SỬ", text: "Xem khoản được phép, khoản bị chặn và mở giao dịch gốc để kiểm chứng.", image: proofArt, page: "proofs" as const, icon: BookOpen },
    ].map(card => <button className="nw-world" key={card.page} onClick={() => navigate(card.page)}><div className="nw-world-art"><img src={card.image} alt="" loading="lazy" /><span><card.icon size={18} /></span></div><div className="nw-world-copy"><small>{card.eyebrow}</small><h3>{card.title}<ArrowUpRight size={19} /></h3><p>{card.text}</p></div></button>)}</div>
    </details><div className="nw-contract-strip"><span><LockKeyhole size={15} />Native NEAR · Testnet</span><code>{CONTRACT}</code><button onClick={() => navigate("help")}>Hiểu cách hoạt động <ArrowRight size={14} /></button></div>
  </div>;
}
