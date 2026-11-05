import { useEffect, useRef, useState } from "react";
import { api, setToken, NearApiError } from "./api";
// Public proof review must not download or initialize the wallet SDK.
const login = async () => (await import("./wallet")).login();
const wallet = async () => (await import("./wallet")).wallet();
const finishCallback = async () => location.pathname === "/near/auth/callback" ? (await import("./wallet")).finishCallback() : undefined;
import { available, CAP, CONTRACT, PAYEE, MIN_OWNER_STORAGE, assertIdentity, near, remainingSeconds, transfer, validateProposal, type OwnerMethod, type Grant, type Ledger, type Proposal } from "./model";
import "./near.css";
import { assertRequestBinding, canComplete, completePending, persistPending, restorePending, type IntentRequest, type JournalRow } from "./pending";
type Row = JournalRow;
type Request = IntentRequest;
import { assertFundingNeeded, assertNoFundingAttempt, beginFunding, completeFunding, fundingAmount, parseFundingStatus, recordFundingHash, restoreFunding, type FundingAttempt, type FundingMethod, type FundingStatus } from "./funding";
import { nextStep, parseAccountSnapshot, type AccountSnapshot } from "./onboarding";
import { ReceiptLink } from "./ReceiptLink";
import { NearPolicyLab } from "./PolicyLab";
import { ProofGallery } from "./ProofGallery";
import { ProposalReview } from "./Review";
import { assertLocalRecovery, recoverStartup, startupGrant } from "./recovery";
import { Overview, Workspace, StatusBadge, pageFromHash, pageForTarget, type WorkspacePage } from "./Workspace";
import { ArrowRight, ArrowUpRight, Info, ShieldCheck, Wallet, RefreshCw } from "lucide-react";
export default function NearApp() {
  const [page, setPage] = useState<WorkspacePage>(() => pageFromHash(location.hash));
  const pageHeading = useRef<HTMLDivElement>(null);
  function navigate(next: WorkspacePage) { setError(""); setPage(next); if (location.pathname !== "/near/auth/callback" && location.hash !== `#/${next}`) history.pushState(null, "", `${location.pathname}${location.search}#/${next}`); }
  useEffect(() => { const onHash = () => setPage(pageFromHash(location.hash)); window.addEventListener("hashchange", onHash); window.addEventListener("popstate", onHash); return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("popstate", onHash); }; }, []);
  useEffect(() => { document.title = "REDLINE for NEAR | Agent Security"; document.getElementById("near-workspace-content")?.scrollTo({ top: 0 }); pageHeading.current?.focus(); }, [page]);
  const [owner, setOwner] = useState(""), [id, setId] = useState(new URLSearchParams(location.search).get("grant") ?? ""), [grant, setGrant] = useState<Grant>(), [balance, setBalance] = useState<Ledger>(), [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [ready, setReady] = useState(false), [hours, setHours] = useState(8), [proposal, setProposal] = useState<Proposal>(), [request, setRequest] = useState<Request>(), [tick, setTick] = useState(Date.now());
  const [ownerFunding, setOwnerFunding] = useState<{ owner: string; status: FundingStatus }>(), [fundingAttempt, setFundingAttempt] = useState<FundingAttempt>(), [fundingHash, setFundingHash] = useState("");
  const [nativeAccount, setNativeAccount] = useState<AccountSnapshot>(), [signingEnabled, setSigningEnabled] = useState(false);
  const [proposalDeadline, setProposalDeadline] = useState<string>();
  const [recoveryErrors, setRecoveryErrors] = useState<string[]>([]);
  async function run(fn: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await fn(); } catch (e) { if (e instanceof NearApiError && e.status === 401) { setOwner(""); setRows([]); setOwnerFunding(undefined); setNativeAccount(undefined); setProposal(undefined); } setError(e instanceof Error ? e.message : "Thao tác chưa hoàn tất."); } finally { setBusy(false); } }
  async function connect() {
    setReady(false); setSigningEnabled(false);
    const health = await api<{ chain: string; network: string; contractId: string; executorId: string; identityEnforced: boolean; signingEnabled: boolean }>("/health");
    assertIdentity(health); setSigningEnabled(health.signingEnabled); setReady(true);
    const account = await finishCallback(); if (account) setOwner(account);
    setMessage(`Đã kiểm tra kết nối API Testnet lúc ${new Date().toLocaleTimeString("vi-VN")}.`);
  }
  useEffect(() => { const saved = recoverStartup(() => localStorage); setId(startupGrant(new URLSearchParams(location.search).get("grant"), saved)); setRecoveryErrors(saved.errors); if (saved.funding) { setFundingAttempt(saved.funding); setFundingHash(saved.funding.hash ?? ""); } if (saved.request) setRequest(saved.request); void run(connect); const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function refresh(account = owner, selectedId = id) {
    // Clear stale views first; an RPC failure must not look like a current snapshot.
    setGrant(undefined); setBalance(undefined); setRows([]);
    let balanceOwner = account;
    let journal: Row[] = [];
    if (selectedId) { const g = await api<{ value: Grant }>(`/near/grants/${encodeURIComponent(selectedId)}`); setGrant(g.value); balanceOwner = g.value.owner; localStorage.setItem("near-grant", selectedId); if (account && g.value.owner === account) journal = await api<Row[]>(`/near/transactions?grantId=${encodeURIComponent(selectedId)}`); }
    if (account) { const own = await api<Row[]>("/near/owner-transactions"); setRows([...new Map([...journal, ...own].map(r => [r.hash, r])).values()]); }
    if (balanceOwner) setBalance((await api<{ value: Ledger }>(`/near/owners/${encodeURIComponent(balanceOwner)}/balance`)).value);
    if (account) await readFunding();
  }
  async function prepare(method: "create_grant" | "revoke_grant") {
    assertLocalRecovery(localStorage);
    assertNoFundingAttempt(localStorage);
    if (method === "create_grant") {
      if (restorePending(localStorage)) throw Error("Đối soát intent đang lưu trước khi tạo quyền mới.");
      const status = await readFunding();
      if (!status.registered || BigInt(status.value.storage_available) < BigInt(MIN_OWNER_STORAGE) || BigInt(available(status.value)) < BigInt(CAP)) throw Error("Ví đăng nhập cần đủ storage và principal trước khi tạo grant. Dùng bước chuẩn bị vault bên dưới.");
    }
    const deadline = method === "create_grant" ? ((BigInt(Date.now()) + BigInt(hours * 3600000)) * 1000000n).toString() : undefined;
    const p = await api<Proposal>("/near/owner-actions", method === "create_grant" ? { method, policy: { spend_cap: CAP, max_transactions: 3, recipients: [PAYEE], expires_at_ns: deadline, cooldown_ns: "0" } } : { method, grantId: id });
    await validateProposal(p, owner, method, id, Date.now(), deadline); setProposalDeadline(deadline); setProposal(p); setMessage("Đề xuất chưa ký. Kiểm tra quyền bên dưới trước khi mở ví.");
  }
  async function sign() {
    if (!proposal) return;
    assertLocalRecovery(localStorage);
    const method = proposal.transaction.actions[0].params.methodName as OwnerMethod;
    if (method === "create_grant" && !proposalDeadline) throw Error("Thiếu hạn grant đã chuẩn bị; chưa mở ví ký.");
    if (method === "create_grant" && restorePending(localStorage)) throw Error("Còn intent đã lưu; chưa đổi sang quyền mới.");
    await validateProposal(proposal, owner, method, id, Date.now(), proposalDeadline);
    const w = await wallet();
    const accounts = await w.getAccounts(); if (accounts[0]?.accountId !== owner) throw Error("Ví đã đổi tài khoản. Đăng nhập lại.");
    const { actionCreators } = await import("@near-js/transactions");
    assertNoFundingAttempt(localStorage);
    let attempt: FundingAttempt | undefined;
    if (method === "deposit" || method === "storage_deposit") {
      attempt = beginFunding(localStorage, owner, method, await readFunding());
      setFundingAttempt(attempt); setFundingHash(""); setProposal(undefined);
    }
    if (method === "create_grant") { const newId = proposal.transaction.actions[0].params.args.grant_id as string; setId(newId); localStorage.setItem("near-grant", newId); }
    const result = await w.signAndSendTransaction({ signerId: owner, receiverId: proposal.transaction.receiverId, actions: proposal.transaction.actions.map(a => actionCreators.functionCall(a.params.methodName, a.params.args, BigInt(a.params.gas), BigInt(a.params.deposit))) });
    setProposal(undefined);
    setMessage("Ví đã xử lý yêu cầu. Chưa coi là SETTLED; kiểm tra FINAL qua lịch sử.");
    if (result && attempt) {
      attempt = recordFundingHash(localStorage, attempt, result.transaction.hash);
      setFundingAttempt(attempt); setFundingHash(attempt.hash!);
      await reconcileOwnerFunding(attempt);
    } else if (result) await api("/near/transactions/track", { hash: result.transaction.hash, signerId: owner });
  }
  async function readFunding() {
    if (!owner) throw Error("Đăng nhập ví trước khi đọc vault của tài khoản này.");
    setOwnerFunding(undefined);
    const status = parseFundingStatus(await api(`/near/owners/${encodeURIComponent(owner)}/funding`));
    setOwnerFunding({ owner, status }); return status;
  }
  async function readNativeAccount() {
    setNativeAccount(undefined);
    setNativeAccount(parseAccountSnapshot(await api(`/near/accounts/${encodeURIComponent(owner)}`), owner));
  }
  async function prepareFunding(method: FundingMethod) {
    assertLocalRecovery(localStorage);
    assertNoFundingAttempt(localStorage);
    assertFundingNeeded(method, await readFunding());
    const p = await api<Proposal>("/near/owner-actions", { method, amount: fundingAmount(method) });
    await validateProposal(p, owner, method); setProposal(p);
    setMessage("Chỉ chuẩn bị đề xuất, chưa chuyển tiền. Xem kỹ khoản NEAR Testnet gửi kèm trước khi ký.");
  }
  async function reconcileOwnerFunding(a: FundingAttempt) {
    if (a.owner !== owner || !a.hash) throw Error("Cần đúng tài khoản và hash từ lịch sử ví. Nếu chưa rõ đã ký hay chưa, không ký lại.");
    const result = await api("/near/owner-actions/reconcile", { hash: a.hash, method: a.method, amount: a.amount, minBlockHeight: a.beforeHeight });
    completeFunding(localStorage, a, result); setFundingAttempt(undefined); setFundingHash("");
    await readFunding(); setMessage(`Đã đối soát FINAL ${a.method}: ${near(a.amount)} NEAR Testnet. Hash: ${a.hash}. Không cần ký lại khoản này.`);
  }
  function prepareIntent(kind: "allow" | "cap" | "recipient" | "replay") {
    assertLocalRecovery(localStorage);
    if (!grant || request) return;
    if (grant.owner !== owner) throw Error("Grant này thuộc tài khoản khác; chỉ xem dữ liệu, chưa tạo intent cho ví đang đăng nhập.");
    if (kind === "replay" && BigInt(grant.next_nonce) === 0n) { setError("Cần có lượt nonce 0 đã xử lý trước khi thử replay. Nonce 0 hiện vẫn hợp lệ."); return; }
    // Persistence must succeed before the request can reach a submit button.
    setRequest(persistPending(localStorage, transfer(grant, id, kind)));
  }
  async function submit() {
    if (!request) return;
    assertLocalRecovery(localStorage);
    assertRequestBinding(request, id, owner, grant);
    if (JSON.stringify(restorePending(localStorage)) !== JSON.stringify(request)) throw Error("Request trong trình duyệt đã thay đổi; khôi phục và kiểm tra trước khi gửi.");
    const response = await api<{ state: string; reason?: string; transactionHash?: string; finalized: boolean }>(`/near/grants/${encodeURIComponent(request.grant_id)}/intents`, request);
    setMessage(`${response.state}${response.reason ? ": " + response.reason : ""} · FINAL: ${response.finalized ? "có" : "chưa"}. ${response.transactionHash ?? ""}`);
    // Always retain identity, including after terminal response: repeated clicks retry the same intent.
    await refresh();
  }
  const left = grant ? remainingSeconds(grant, tick) : 0;
  const funds = ownerFunding?.owner === owner ? ownerFunding.status : undefined;
  const canCreateGrant = recoveryErrors.length === 0 && funds?.registered && BigInt(funds.value.storage_available) >= BigInt(MIN_OWNER_STORAGE) && BigInt(available(funds.value)) >= BigInt(CAP);
  const step = nextStep({ ready, owner, funds, grant, pendingFunding: !!fundingAttempt, pendingRequest: !!request, requestFinal: !!request && canComplete(request, rows), now: tick });
  async function openDemo() {
    assertLocalRecovery(localStorage);
    if (request || fundingAttempt || proposal) throw Error("Hoàn tất thao tác đang lưu trước khi đổi grant.");
    const demo = "grant-1b031438090c4fa1902eb9ddcbd1f47c";
    setId(demo); navigate("permissions"); await refresh(owner, demo);
  }
  const hasPending = !!request || !!fundingAttempt;
  const savedReceipt = request ? rows.find(row => row.grantId === request.grant_id && row.intentId === request.intent_id) : undefined;
  const createBlockedReason = !ready ? "Kết nối API trong Hướng dẫn trước khi tạo quyền." : !owner ? "Kết nối và đăng nhập ví để tạo quyền của bạn." : fundingAttempt ? "Đối soát khoản nạp đang lưu trước khi ký quyền khác." : request ? "??i so?t v? k?t th?c intent ?ang l?u tr??c khi t?o quy?n m?i." : proposal ? "?ang xem m?t ?? xu?t. K? ho?c h?y ?? xu?t ?? tr??c.": recoveryErrors.length ? "Dữ liệu khôi phục cần được kiểm tra trước khi ký." : !funds ? "Vào Ví & quỹ và đọc quỹ của bạn trước." : !funds.registered ? "Ví này cần đăng ký storage trong vault." : BigInt(funds.value.storage_available) < BigInt(MIN_OWNER_STORAGE) ? "Storage không đủ cho demo; kiểm tra quỹ trước." : BigInt(available(funds.value)) < BigInt(CAP) ? "Principal khả dụng chưa đủ cho ngân sách 0,05 NEAR." : "Sẵn sàng chuẩn bị. Chưa ký hoặc gửi giao dịch.";

  return <Workspace page={page} navigate={navigate} owner={owner} ready={ready} busy={busy} onWallet={() => owner ? navigate("vault") : void run(async () => { setOwner(await login()); navigate("vault"); })}>
    <div ref={pageHeading} tabIndex={-1} className="nw-focus-anchor" />
    <div aria-live="polite">{error && <p className="near-error" role="alert">{error}</p>}{message && <p className="near-notice">{message}</p>}{busy && <p>Đang xử lý… Giữ nguyên cửa sổ, không tạo request thay thế.</p>}</div>
    {recoveryErrors.length > 0 && <p className="near-error" role="alert">{recoveryErrors.join(" ")} API chỉ đọc và Policy Lab vẫn dùng được khi kết nối sẵn sàng. Không xóa localStorage để vượt bước đối soát.</p>}

    {hasPending && <div className="nw-pending-banner"><Info size={18} /><div><strong>{fundingAttempt ? "Có lần ký funding cần đối soát" : "Có intent đã lưu"}</strong><p>Giữ nguyên yêu cầu. Không tự gửi lại hoặc tạo khoản nạp mới.</p></div><button onClick={() => navigate(fundingAttempt ? "vault" : "activity")}>Xem thao tác <ArrowRight size={15} /></button></div>}
    <div hidden={page !== "overview"}><Overview owner={owner} grant={grant} balance={balance} ready={ready} hasPending={hasPending} nextText={step.text} nextTarget={step.target} navigate={navigate} onDemo={() => void run(openDemo)} demoBlocked={busy || hasPending || !!proposal || recoveryErrors.length > 0} /></div>
    <div hidden={page !== "vault"} className="nw-vault-page">
<section id="near-owner"><h2>Ví của bạn</h2>
    <div className="nw-wallet-heading"><span className="nw-account-icon"><Wallet size={22} /></span><div><span className="nw-eyebrow">YOUR TESTNET ACCOUNT</span><p role="status">{owner ? `Đã đăng nhập: ${owner}` : "Chưa đăng nhập"}</p></div></div>
    {!owner ? <button disabled={busy || !ready} onClick={() => void run(async () => setOwner(await login()))} className="nw-primary">Kết nối & đăng nhập ví Testnet</button> :
      <button disabled={busy} onClick={() => void run(async () => { await api("/near/auth/logout", {}); setToken(""); setOwner(""); setRows([]); setProposal(undefined); setOwnerFunding(undefined); setNativeAccount(undefined); })}>Đăng xuất</button>}
    <p className="near-muted">{owner ? "Đăng nhập không cấp quyền chuyển tiền. Giao dịch của chủ ví vẫn cần xem lại và ký riêng." : "Kết nối tài khoản Intear Wallet Testnet. Đăng nhập chỉ ký thông điệp, không chuyển tiền."}</p>
    <a href="https://wallet.intear.tech/" target="_blank" rel="noreferrer">Mở Intear Wallet ↗</a>
    <button disabled={busy || !owner || !ready} onClick={() => void run(readNativeAccount)}>Đọc số dư tài khoản ví</button>
    {nativeAccount?.accountId === owner && <p>Số dư tài khoản: <b>{near(nativeAccount.amount)} NEAR Testnet</b> · đang khóa {near(nativeAccount.locked)} NEAR · FINAL block {nativeAccount.blockHeight}. Số này chưa trừ yêu cầu lưu trữ của tài khoản; không phải tiền trong vault hay mức gas có thể chi.</p>}
    <div className="nw-section-divider" /><h3>Quỹ trong vault</h3>
    <p>Tiền của bạn được ghi riêng trong vault. Phí lưu trữ và tiền agent có thể chi là hai khoản khác nhau. Làm mới quỹ trước khi chuẩn bị khoản nạp.</p>
    <button disabled={busy || !owner || !ready} onClick={() => void run(async () => { await readFunding(); })}><RefreshCw size={14} />Làm mới quỹ của tôi</button>
    {funds ? funds.registered ? <div className="nw-vault-balances"><article><span>TIỀN KHẢ DỤNG</span><strong>{near(available(funds.value))}<small>NEAR</small></strong><p>Đã trừ chi tiêu, giữ chỗ và khoản rút đang chờ.</p></article><article><span>PHÍ LƯU TRỮ CÒN</span><strong>{near(funds.value.storage_available)}<small>NEAR</small></strong><p>Dành cho dữ liệu trong vault, không tính vào ngân sách agent.</p></article></div> : <p className="nw-action-hint"><Info size={15} />Ví này chưa đăng ký storage trong vault.</p> : <p className="nw-action-hint"><Info size={15} />{owner ? "Bấm Làm mới quỹ của tôi để kiểm tra trước khi nạp." : "Đăng nhập ví để đọc quỹ của riêng bạn."}</p>}
    <div className="nw-section-divider" /><span className="nw-eyebrow">THIẾT LẬP BAN ĐẦU</span><h3>Chỉ nạp khi quỹ chưa sẵn sàng</h3><p className="near-muted">Storage: 0,05 NEAR. Principal ban đầu: 0,1 NEAR. Mỗi khoản có bước xem lại và chữ ký riêng. Không nạp lại chỉ để xem demo lịch sử.</p>
    <button disabled={busy || recoveryErrors.length > 0 || !owner || !ready || !funds || !!fundingAttempt || (funds?.registered && BigInt(funds.value.storage_available) >= BigInt(MIN_OWNER_STORAGE))} onClick={() => void run(() => prepareFunding("storage_deposit"))}>Xem đề xuất storage 0,05 NEAR</button>
    <button disabled={busy || recoveryErrors.length > 0 || !owner || !ready || !!fundingAttempt || !funds?.registered || funds.value.credited !== "0"} onClick={() => void run(() => prepareFunding("deposit"))}>Xem đề xuất principal 0,1 NEAR</button>
    <button disabled={busy || !owner} onClick={() => void run(async () => { const saved = restoreFunding(localStorage); if (!saved || saved.owner !== owner) throw Error("Không có funding đã lưu cho tài khoản đang đăng nhập."); setFundingAttempt(saved); setFundingHash(saved.hash ?? ""); })}>Khôi phục lần ký funding</button>
    {funds?.registered && funds.value.credited !== "0" && <p className="nw-action-hint"><ShieldCheck size={15} />Đã có principal trong ledger; không cần lặp lại khoản nạp ban đầu.</p>}
    {fundingAttempt && <div className="near-review"><p>Funding cần đối soát: {fundingAttempt.method} · {near(fundingAttempt.amount)} NEAR Testnet. Giữ nguyên lần ký, chưa ký lại.</p><label>Transaction hash công khai (lấy từ kết quả hoặc lịch sử ví)<input value={fundingHash} onChange={e => setFundingHash(e.target.value)} /></label><button disabled={busy || !owner || !fundingHash} onClick={() => void run(async () => { const saved = recordFundingHash(localStorage, fundingAttempt, fundingHash.trim()); setFundingAttempt(saved); await reconcileOwnerFunding(saved); })}>Đối soát funding · không ký</button><p>Nếu đã hủy trước khi ký hoặc không có hash, dừng để kiểm tra; không xóa bản ghi và nạp lại chỉ vì timeout.</p></div>}
</section>
    </div>
    <div hidden={page !== "permissions"} className="near-grid">
    <section id="near-grant"><h2>Quyền đang xem</h2><label>Mã quyền (Grant ID)<input disabled={busy || !!request || !!fundingAttempt || !!proposal} placeholder="Nhập mã quyền đã ký, hoặc mở demo lịch sử" value={id} onChange={e => { setId(e.target.value); setGrant(undefined); setBalance(undefined); setRows([]); }} /></label><button disabled={busy || !ready} onClick={() => void run(() => refresh())}><RefreshCw size={14} />Đọc snapshot FINAL</button>{grant && <><p>Owner: <code>{grant.owner}</code>{owner && owner !== grant.owner && " (read-only)"}</p><p>{grant.active ? left > 0 ? "Đang có hiệu lực" : "Hết hạn" : "Đã thu hồi"} · còn {Math.floor(left / 3600)}h {Math.floor(left % 3600 / 60)}m {Math.floor(left % 60)}s</p><p>Ngân sách còn: <b>{near((BigInt(grant.policy.spend_cap) - BigInt(grant.finalized_spent) - BigInt(grant.pending_reserved)).toString())} NEAR</b></p><p>Đã chi {near(grant.finalized_spent)} · đang giữ {near(grant.pending_reserved)} · nonce {grant.next_nonce}</p><p>Deadline: {new Date(Number(BigInt(grant.policy.expires_at_ns) / 1000000n)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (UTC+7)</p><button disabled={busy || recoveryErrors.length > 0 || owner !== grant.owner || !grant.active} onClick={() => void run(() => prepare("revoke_grant"))}>Xem đề xuất thu hồi</button></>}{balance && <p>Tiền khả dụng trong quỹ: <b>{near(available(balance))} NEAR</b> · storage riêng: {near(balance.storage_available)} NEAR</p>}<p className="near-muted">Thu hồi chặn ý định mới; transfer đã dispatch vẫn chờ callback. Nút refresh đọc snapshot mới, không tự polling RPC.</p></section>    <section className="nw-policy-setup"><span className="nw-eyebrow">OWNER AUTHORIZATION</span><h2>Tạo quyền cho agent</h2>
    <div className="nw-limit-facts"><div><small>NGÂN SÁCH TỐI ĐA</small><strong>0,05 <span>NEAR</span></strong></div><div><small>SỐ LƯỢT</small><strong>3 <span>giao dịch</span></strong></div></div><p className="near-muted">Người nhận duy nhất: <code>{PAYEE}</code></p>
    <label>Thời hạn cấp quyền <select disabled={busy || !!proposal} value={hours} onChange={e => setHours(Number(e.target.value))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} giờ</option>)}</select></label><button disabled={busy || !owner || !ready || !canCreateGrant || !!fundingAttempt || !!request || !!proposal} onClick={() => void run(() => prepare("create_grant"))} className="nw-primary">Xem đề xuất cấp quyền <ArrowRight size={15} /></button><p className="nw-action-hint"><Info size={14} />{createBlockedReason}</p>{!canCreateGrant && <button className="nw-text-button" onClick={() => navigate("vault")}>Đến Ví & quỹ <ArrowRight size={14} /></button>}
    <p className="near-muted">Chỉ tạo quyền mới khi cần chạy một demo mới. Xem bằng chứng lịch sử không cần ký.</p></section></div>
    <div hidden={page !== "lab"}>
    {grant ? <NearPolicyLab key={`${id}:${owner}:${grant.next_nonce}:${grant.policy.policy_hash}`} grantId={id} owner={owner} nonce={grant.next_nonce} policyHash={grant.policy.policy_hash} disabled={busy || !ready} reviewBlocked={recoveryErrors.length > 0 || !!request || !!fundingAttempt || !!proposal} onReview={candidate => { assertLocalRecovery(localStorage); assertNoFundingAttempt(localStorage); assertRequestBinding(candidate, id, owner, grant); if (request || proposal) throw Error("Hoàn tất đề xuất hiện tại trước."); setRequest(persistPending(localStorage, candidate)); navigate("activity"); setMessage("Đã lưu đề xuất từ Policy Lab trong Hoạt động. Xem lại trước khi gửi; chưa có giao dịch mới."); }} /> : <section id="near-policy-lab"><h2>Policy Lab / Copilot NEAR</h2><div className="nw-empty-state"><ShieldCheck size={28} /><h3>Chọn một quyền để bắt đầu phân tích</h3><p>Đọc quyền của bạn hoặc mở snapshot demo đã thu hồi. Policy Lab chỉ đọc dữ liệu, không cần ký.</p><button className="nw-primary" disabled={busy || hasPending || !!proposal || !ready} onClick={() => void run(openDemo)}>Đọc demo lịch sử</button><button onClick={() => navigate("permissions")}>Chọn quyền hiện có</button></div></section>}
    </div>
    <div hidden={page !== "activity"}>
    <details className="nw-security-disclosure" open={request ? true : undefined}><summary><ShieldCheck size={17} /><span>Thử ALLOW / chặn vi phạm</span><small>Giao dịch Testnet thật · chủ động mở</small></summary>
    <section id="near-intents"><h2>Kiểm thử giới hạn</h2><p className="nw-action-hint"><ShieldCheck size={15} />Chỉ mở khi chủ động kiểm thử. Xem lịch sử bên dưới không tạo giao dịch mới.</p><p>Các nút chỉ chuẩn bị JSON. Gửi là giao dịch Testnet thật, executor trả phí gas/storage kể cả bị từ chối. ALLOW chuyển 0,01 NEAR.</p><div className="near-actions">{([['allow','ALLOW 0,01 NEAR'],['cap','Vượt cap'],['recipient','Sai người nhận'],['replay','Replay nonce 0']] as const).map(([kind,label]) => <button key={kind} disabled={busy || recoveryErrors.length > 0 || !grant || !owner || grant.owner !== owner || !!request} onClick={() => void run(async () => prepareIntent(kind))}>{label}</button>)}<button disabled={busy || !!request} onClick={() => void run(async () => { const saved = restorePending(localStorage); if (!saved) throw Error("Không có request đã lưu."); setRequest(saved); })}>Khôi phục request sau reload</button></div>
    {request && <div className="near-review"><div className="nw-intent-summary"><strong>{near(request.amount)} NEAR</strong><span>Người nhận: <code>{request.recipient}</code></span><span>Nonce {request.nonce} · <code>{request.intent_id}</code></span></div><details className="nw-json"><summary>Xem JSON yêu cầu</summary><pre>{JSON.stringify(request, null, 2)}</pre></details>{savedReceipt && <button disabled={busy || !owner || !ready} onClick={() => void run(async () => { await api("/near/transactions/track", { hash: savedReceipt.hash, signerId: savedReceipt.signerId ?? "nhat-redline-agent.testnet" }); await refresh(); setMessage("Đã đọc lại receipt. Không gửi lại giao dịch."); })}>Đối soát receipt · không gửi lại</button>}<button disabled={busy || recoveryErrors.length > 0 || !owner || !ready || !signingEnabled || canComplete(request, rows)} onClick={() => void run(submit)}>Gửi / thử lại cùng intent · Testnet</button><p>UNKNOWN/PENDING: giữ nguyên intent. Trang khôi phục sau reload nhưng không tự gửi lại. Để kiểm tra kết quả đã có, dùng Đối soát FINAL trong lịch sử.</p><button className="nw-primary" disabled={busy || !canComplete(request, rows)} onClick={() => void run(async () => { completePending(localStorage, request, rows); setRequest(undefined); })}>Đã có kết quả cuối · Chuẩn bị case tiếp</button></div>}</section>
    </details>
    <section id="near-history"><h2>Lịch sử giao dịch</h2><button disabled={busy || !owner || !ready} onClick={() => void run(async () => { const own = await api<Row[]>("/near/owner-transactions"); setRows(current => [...new Map([...current, ...own].map(r => [r.hash, r])).values()]); })}>Đọc lịch sử giao dịch chủ ví</button><p>SETTLED là callback đã xác nhận transfer; UNKNOWN/PENDING chưa chứng minh chuyển tiền thành công. Đây là journal của chủ grant, không phải toàn bộ lịch sử chain.</p>{rows.length === 0 ? <div className="nw-empty-state"><span><ShieldCheck size={28} /></span><h3>Chưa có lịch sử được tải</h3><p>Kết nối ví và đọc quyền để xem các giao dịch của bạn, hoặc mở bằng chứng demo đã xác minh.</p><button onClick={() => navigate("permissions")}>Đọc quyền hiện có</button><button onClick={() => navigate("proofs")}>Xem bằng chứng demo</button></div> : <div className="near-table"><table><thead><tr><th>Intent</th><th>Trạng thái</th><th>Lý do</th><th>Receipt</th></tr></thead><tbody>{rows.map(r => <tr key={r.hash}><td>{r.intentId ?? "Owner action"}</td><td><StatusBadge state={r.state} /></td><td>{r.reason ?? "—"}</td><td><ReceiptLink hash={r.hash} /><button disabled={busy} onClick={() => void run(async () => { await api("/near/transactions/track", { hash: r.hash, signerId: r.signerId ?? (r.intentId ? "nhat-redline-agent.testnet" : owner) }); await refresh(); })}>Đối soát FINAL</button></td></tr>)}</tbody></table></div>}<p className="near-muted">Demo tấn công là JSON có kiểm soát; không gắn nhãn là LLM tự thực hiện. Kiểm thử concurrency/callback lỗi hiện có bằng chứng sandbox riêng.</p></section>
    </div>
    <div hidden={page !== "proofs"}>
    <section className="nw-proof-intro"><span className="nw-eyebrow">INSPECT THE EVIDENCE</span><h2>Đừng chỉ tin giao diện. Kiểm tra trên chain.</h2><p>Demo có ALLOW, chặn vượt cap, sai người nhận, replay và thu hồi. Receipt lịch sử có thể xem ngay, không cần kết nối ví.</p><button className="nw-primary" disabled={busy || !!request || !!fundingAttempt || !!proposal || recoveryErrors.length > 0 || !ready} onClick={() => void run(openDemo)}>Mở snapshot demo đã thu hồi <ArrowUpRight size={15} /></button>{hasPending && <p className="near-muted">Đang giữ một thao tác cũ. Hoàn tất đối soát trước khi đổi grant; các link receipt bên dưới vẫn mở được.</p>}</section>
    <ProofGallery />
    </div>
    <div hidden={page !== "help"}>
    <section id="near-setup"><h2>Bắt đầu trên NEAR Testnet</h2><button disabled={busy} onClick={() => void run(connect)}>Kiểm tra kết nối API</button><p>{step.text}</p><a href={`#/${pageForTarget(step.target)}`} onClick={() => navigate(pageForTarget(step.target))}>Đi đến bước cần làm ↓</a><p className="near-muted">{ready ? signingEnabled ? "API Testnet đã kết nối; executor đã cấu hình." : "API chỉ đọc: executor chưa cấu hình. Có thể xem bằng chứng, chưa gửi demo." : "Chưa xác minh được API Testnet."} Không dùng tài khoản .near Mainnet. Dashboard/Policy Lab gốc mở ở tab riêng và không điều khiển grant NEAR.</p><details><summary>Lần đầu chạy hoặc vừa đóng PowerShell</summary><ol><li>Backend: trong thư mục backend, chạy <code>.\scripts\start-near-local.ps1</code>, giữ cửa sổ mở.</li><li>Frontend: tại thư mục dự án, chạy <code>npm.cmd run dev -- --host localhost --port 5173 --strictPort</code>, giữ cửa sổ mở.</li><li>Mở <a href="http://localhost:5173/near">localhost:5173/near</a>. Cổng 8787 là API; trang gốc API trả 404 là bình thường.</li><li>Cho phép popup cho localhost. Trong Intear chọn tài khoản .testnet; đăng nhập chỉ ký thông điệp. Sau F5 cần đăng nhập lại.</li></ol><p>Cài đặt lần đầu cần Node/Postgres và executor do chủ tài khoản thiết lập theo README. Không nhập khóa riêng vào REDLINE.</p></details><ol><li>Đăng nhập → đọc vault → ký storage rồi principal nếu ví chưa có.</li><li>Tạo grant riêng → đọc snapshot FINAL → chuẩn bị và gửi ALLOW.</li><li>Chỉ sau kết quả FINAL mới chuyển sang cap / sai người nhận / replay → thu hồi → thử sau thu hồi.</li><li>Xem lịch sử, sao chép hash/link để kiểm chứng. Grant demo cũ đã thu hồi; không nạp lại để xem bằng chứng.</li></ol></section>
    </div>
    <div className="nw-global-review">
    {proposal && <ProposalReview proposal={proposal} busy={busy} blocked={recoveryErrors.length > 0 || !!fundingAttempt} onSign={() => void run(sign)} onCancel={() => { setProposal(undefined); setProposalDeadline(undefined); }} />}
    </div>
  </Workspace>;
}
