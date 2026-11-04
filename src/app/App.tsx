import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Cpu,
  ChevronDown,
  Globe,
  Layers,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BackendStatusBanner } from "./components/BackendStatus";
import { CommandPalette } from "./components/CommandPalette";
import { OverviewPage } from "./components/OverviewPage";
import { SolanaWalletControl } from "./components/SolanaWalletControl";
import { LanguageToggle } from "./components/LanguageToggle";
import { Notifications } from "./components/Notifications";
import { useLang, useT } from "./i18n/LanguageContext";
import { applyPreference, readPreference } from "./frontend/preferences";
import { playSound } from "./lib/soundscape";
const CopilotPage = lazy(() => import("./components/ArtifactPages").then(m => ({ default: m.CopilotPage })));
const ModelsPage = lazy(() => import("./components/ArtifactPages").then(m => ({ default: m.ModelsPage })));
const ProfilePage = lazy(() => import("./components/ArtifactPages").then(m => ({ default: m.ProfilePage })));
const GuidePage = lazy(() => import("./components/GuidePage").then(m => ({ default: m.GuidePage })));
const ArtifactAgents = lazy(() => import("./frontend/Pages").then(m => ({ default: m.ArtifactAgents })));
const ArtifactAnalytics = lazy(() => import("./frontend/Pages").then(m => ({ default: m.ArtifactAnalytics })));
const ArtifactAudit = lazy(() => import("./frontend/Pages").then(m => ({ default: m.ArtifactAudit })));
const ArtifactProtocol = lazy(() => import("./frontend/Pages").then(m => ({ default: m.ArtifactProtocol })));
const MarketplacePage = lazy(() => import("./OperationalPages").then(m => ({ default: m.MarketplacePage })));
const SessionsPage = lazy(() => import("./OperationalPages").then(m => ({ default: m.SessionsPage })));
const SettingsPage = lazy(() => import("./OperationalPages").then(m => ({ default: m.SettingsPage })));
const VaultPage = lazy(() => import("./OperationalPages").then(m => ({ default: m.VaultPage })));

const VI: Record<string, string> = {
  "Overview": "Tổng quan",
  "Spending limits": "Hạn mức chi",
  "Vault": "Quỹ",
  "Activity": "Hoạt động",
  "More": "Thêm",
  "More tools": "Công cụ khác",
  "Help": "Hướng dẫn",
  "About REDLINE": "Về REDLINE",
  "Loading page…": "Đang tải trang…",
  "Choose an agent, see its activity, or publish a version when you need to.": "Chọn agent, xem hoạt động hoặc xuất bản phiên bản khi cần.",
  "Skip to content": "Đến nội dung chính",
  "Manage your agents in a few simple steps.": "Quản lý agent qua vài bước đơn giản.",
  "Choose an agent and set how much it can spend, who it can pay, and when access ends.": "Chọn agent, đặt số tiền được chi, người được nhận và thời điểm hết quyền truy cập.",
  "Add test funds, check your balance, or withdraw to your wallet.": "Nạp tiền thử nghiệm, xem số dư hoặc rút về ví của bạn.",
  "See what happened and open the transaction details when you need them.": "Xem những gì đã diễn ra và mở chi tiết giao dịch khi cần.",
  "Protocol": "Protocol",
  "Marketplace": "Marketplace",
  "Agents": "Agents",
  "My Agents": "Agent của tôi",
  "Guardrails": "Guardrails",
  "Treasury": "Treasury",
  "Audit": "Audit",
  "Audit trail": "Nhật ký kiểm toán",
  "Analytics": "Phân tích",
  "Settings": "Cài đặt",
  "Copilot": "Copilot",
  "Models": "Mô hình",
  "Model profiling": "Đo hiệu năng mô hình",
  "Profile": "Hồ sơ",
  "Owner profile": "Hồ sơ chủ sở hữu",
  "Guide": "Hướng dẫn",
  "The agent proposes. The chain decides.": "Agent đề xuất. Chain quyết định.",
  "Discover immutable agent versions. Rent with your wallet; every agreement is verified on Solana.": "Khám phá các phiên bản agent bất biến. Thuê bằng ví của bạn; mọi thỏa thuận đều được xác minh trên Solana.",
  "Each version is pinned by an agentHash — SHA-256 of model, code and configuration — so a grant can only ever bind to one exact build.": "Mỗi phiên bản được ghim bằng agentHash — SHA-256 của model, code và cấu hình — nên một grant chỉ có thể gắn với đúng một bản build.",
  "Sign a boundary, then watch the agent operate inside it. Seven gates enforce every proposal in one transaction.": "Ký một ranh giới, rồi xem agent hoạt động bên trong. Bảy gate thực thi mọi đề xuất trong một giao dịch.",
  "Your program-owned vault. Refill on devnet, inspect reserves, withdraw as the owner.": "Vault do program sở hữu của bạn. Nạp trên devnet, xem dự trữ, rút với tư cách chủ sở hữu.",
  "Every intent, decision and signature — decoded from the program and connected to its evidence.": "Mọi ý định, quyết định và chữ ký — giải mã từ program và gắn với bằng chứng của nó.",
  "Confirmed volume, policy outcomes and agent activity. Every figure comes from the recorded ledger.": "Khối lượng đã xác nhận, kết quả chính sách và hoạt động của agent. Mọi con số đều lấy từ sổ cái đã ghi.",
  "Network, wallet and experience. The deployment stays anchored to its on-chain program.": "Mạng, ví và trải nghiệm. Bản triển khai luôn neo vào program on-chain của nó.",
  "Ask the ledger in English or Vietnamese. Your assistant explains; your wallet remains the signer.": "Hỏi sổ cái bằng tiếng Anh hoặc tiếng Việt. Trợ lý giải thích; ví của bạn vẫn là bên ký.",
  "Inspect the configured assistant, run a real request and measure its response.": "Xem trợ lý đã cấu hình, gửi một yêu cầu thật và đo phản hồi của nó.",
  "Your wallet identity, signed authority and confirmed on-chain activity.": "Định danh ví của bạn, quyền đã ký và hoạt động on-chain đã xác nhận.",
  "A practical guide to REDLINE.": "Hướng dẫn thực hành REDLINE.",
  "Open Protocol": "Mở Protocol",
  "Open navigation": "Mở menu",
  "Primary navigation": "Điều hướng chính",
  "Find a page": "Tìm trang",
  "Find": "Tìm",
  "Open owner profile": "Mở hồ sơ chủ sở hữu",
  "Mobile navigation": "Điều hướng di động",
  "Pages": "Trang",
  "page": "trang",
  "HELP": "TRỢ GIÚP",
  "PREV": "TRƯỚC",
  "NEXT": "TIẾP",
};

const routes = [
  {
    slug: "protocol",
    label: "Overview",
    title: "Overview",
    icon: ShieldCheck,
    description: "Manage your agents in a few simple steps.",
    page: OverviewPage,
  },
  {
    slug: "marketplace",
    label: "Marketplace",
    title: "Marketplace",
    icon: Globe,
    description:
      "Discover immutable agent versions. Rent with your wallet; every agreement is verified on Solana.",
    page: MarketplacePage,
  },
  {
    slug: "agents",
    label: "My Agents",
    title: "My Agents",
    icon: Bot,
    description:
      "Choose an agent, see its activity, or publish a version when you need to.",
    page: ArtifactAgents,
  },
  {
    slug: "guardrails",
    label: "Spending limits",
    title: "Spending limits",
    icon: Layers,
    description:
      "Choose an agent and set how much it can spend, who it can pay, and when access ends.",
    page: SessionsPage,
  },
  {
    slug: "treasury",
    label: "Vault",
    title: "Vault",
    icon: Wallet,
    description:
      "Add test funds, check your balance, or withdraw to your wallet.",
    page: VaultPage,
  },
  {
    slug: "audit",
    label: "Activity",
    title: "Activity",
    icon: BookOpen,
    description:
      "See what happened and open the transaction details when you need them.",
    page: ArtifactAudit,
  },
  {
    slug: "analytics",
    label: "Analytics",
    title: "Analytics",
    icon: Activity,
    description:
      "Confirmed volume, policy outcomes and agent activity. Every figure comes from the recorded ledger.",
    page: ArtifactAnalytics,
  },
  {
    slug: "settings",
    label: "Settings",
    title: "Settings",
    icon: Settings,
    description:
      "Network, wallet and experience. The deployment stays anchored to its on-chain program.",
    page: SettingsPage,
  },
  {
    slug: "copilot",
    label: "Copilot",
    title: "Copilot",
    icon: Sparkles,
    description:
      "Ask the ledger in English or Vietnamese. Your assistant explains; your wallet remains the signer.",
    page: CopilotPage,
  },
  {
    slug: "models",
    label: "Models",
    title: "Model profiling",
    icon: Cpu,
    description:
      "Inspect the configured assistant, run a real request and measure its response.",
    page: ModelsPage,
  },
  {
    slug: "profile",
    label: "Profile",
    title: "Owner profile",
    icon: Wallet,
    description:
      "Your wallet identity, signed authority and confirmed on-chain activity.",
    page: ProfilePage,
  },
  {
    slug: "guide",
    label: "Guide",
    title: "Guide",
    icon: BookOpen,
    description: "A practical guide to REDLINE.",
    page: GuidePage,
  },
  {
    slug: "about",
    label: "About REDLINE",
    title: "About REDLINE",
    icon: ShieldCheck,
    description: "The agent proposes. The chain decides.",
    page: ArtifactProtocol,
  },
];
const headerOrder = [0, 2, 4, 5];
const moreOrder = [3, 1, 6, 8, 9, 10, 7, 12];
const oldRouteOrder = [
  "protocol",
  "agents",
  "analytics",
  "marketplace",
  "treasury",
  "audit",
  "guardrails",
  "settings",
  "guide",
  "copilot",
  "models",
  "profile",
];
const readRoute = () => {
  const [slug, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return { ...(routes.find(r => r.slug === slug) ?? routes[0]), query };
};

export default function App() {
  const tr = useT(VI);
  const { lang } = useLang();
  const [route, setRoute] = useState(readRoute);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const more = useRef<HTMLDetailsElement>(null);
  const main = useRef<HTMLElement>(null);
  const navigate = (slug: string) => {
    location.hash = `/${slug}`;
    setMenu(false);
    if (more.current) more.current.open = false;
  };
  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      setMenu(false);
      if (more.current) more.current.open = false;
      playSound("navigate");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    applyPreference("depth", readPreference("depth"));
    applyPreference("motion", readPreference("motion"));
  }, []);
  useEffect(() => {
    document.title = `${tr(route.title)} · REDLINE`;
    main.current?.scrollTo({ top: 0 });
  }, [route, lang]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (more.current && !more.current.contains(event.target as Node)) more.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") {
        setMenu(false);
        setSearch(false);
        if (more.current) more.current.open = false;
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const index = routes.findIndex((r) => r.slug === route.slug),
    Page = route.page;
  const commandItems = routes.map((r) => ({
    label: tr(r.label),
    description: tr(r.description),
    icon: r.icon,
    shortcut: "",
    onSelect: () => navigate(r.slug),
  }));
  return (
    <div className="app redline-artifact simple-ui" data-route={route.slug}>
      <a className="skip-link" href="#main-content" onClick={event => {
        event.preventDefault();
        main.current?.focus();
      }}>{tr("Skip to content")}</a>
      <header className="hdr">
        <button
          className="brand"
          onClick={() => navigate("protocol")}
          aria-label={tr("Overview")}
        >
          <span className="emblem">
            <ShieldCheck size={16} />
          </span>
          <span>REDLINE</span>
        </button>
        <button
          className="tool mobile-menu"
          onClick={() => setMenu((v) => !v)}
          aria-label={tr("Open navigation")}
          aria-expanded={menu}
          aria-controls="mobile-navigation"
        >
          {menu ? <X size={16} /> : <Menu size={16} />}
        </button>
        <nav className="nav" aria-label={tr("Primary navigation")}>
          <a href="/near" target="_blank" rel="noreferrer" title="NEAR Testnet · mở riêng, không đổi mạng hay quyền ví Solana">NEAR Testnet ↗</a>
          {headerOrder.map((i) => (
            <button
              key={i}
              aria-current={route.slug === routes[i].slug ? "page" : undefined}
              onClick={() => navigate(routes[i].slug)}
            >
              <span>{tr(routes[i].label)}</span>
            </button>
          ))}
          <details className="nav-more" ref={more}>
            <summary aria-current={moreOrder.includes(index) ? "page" : undefined}>{tr("More")} <ChevronDown size={14} /></summary>
            <div className="nav-more-list" aria-label={tr("More tools")}>
              {moreOrder.map(i => {
                const item = routes[i];
                return <button key={item.slug} aria-current={route.slug === item.slug ? "page" : undefined} onClick={() => navigate(item.slug)}><item.icon size={16} />{tr(item.label)}</button>;
              })}
            </div>
          </details>
        </nav>
        <div className="tools">
          <button
            className="tool"
            onClick={() => setSearch(true)}
            aria-label={tr("Find a page")}
          >
            <Search size={13} />
            <span>{tr("Find")}</span>
            <kbd>⌘K</kbd>
          </button>
          <LanguageToggle />
          <Notifications />
          <span className="netpill">
            <i />
            DEVNET
          </span>
          <div className="wallet-slot">
            <SolanaWalletControl />
          </div>
        </div>
        {menu && (
          <nav id="mobile-navigation" className="mobile-navigation" aria-label={tr("Mobile navigation")}>
            {[...headerOrder, 11].map(i => routes[i]).map((r) => (
              <button
                key={r.slug}
                aria-current={route.slug === r.slug ? "page" : undefined}
                onClick={() => navigate(r.slug)}
              >
                <r.icon size={16} />
                {tr(r.label)}
                <ArrowRight size={14} />
              </button>
            ))}
            <details className="mobile-more">
              <summary>{tr("More tools")}<ChevronDown size={16} /></summary>
              <div className="mobile-more-list">{moreOrder.map(i => routes[i]).map(item => <button key={item.slug} aria-current={route.slug === item.slug ? "page" : undefined} onClick={() => navigate(item.slug)}><item.icon size={16} />{tr(item.label)}<ArrowRight size={14} /></button>)}</div>
            </details>
          </nav>
        )}
      </header>
      {/* One shared probe for the whole shell. A cold Render service takes most
          of a minute to wake, and the dashboard used to report that as OFFLINE
          on every page at once. */}
      <BackendStatusBanner />
      <main
        ref={main}
        id="main-content"
        tabIndex={-1}
        className="main-scroll page"
        aria-label={`${tr(route.title)} ${tr("page")}`}
      >
        {index !== 0 && (
          <div className="simple-page-heading">
            <div className="tl-id">
              <h1>{tr(route.title)}</h1>
            </div>
            {![2, 3, 5].includes(index) && <p>{tr(route.description)}</p>}
            <button type="button" className="simple-help" onClick={() => navigate("guide")}><BookOpen size={16} />{tr("Help")}</button>
          </div>
        )}
        <div key={`${route.slug}:${route.query}`} className="route-enter">
          <Suspense fallback={<p className="simple-loading" role="status">{tr("Loading page…")}</p>}>
            <Page setNav={(n: number) => navigate(oldRouteOrder[n] ?? "protocol")} />
          </Suspense>
        </div>
      </main>
      <CommandPalette
        open={search}
        onClose={() => setSearch(false)}
        items={commandItems}
      />
    </div>
  );
}
