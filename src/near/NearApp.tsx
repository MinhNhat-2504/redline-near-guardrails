import { useEffect, useState } from "react";
import { api, setToken, NearApiError } from "./api";
import { finishCallback, login, wallet } from "./wallet";
import { available, CAP, CONTRACT, PAYEE, MIN_OWNER_STORAGE, assertIdentity, near, remainingSeconds, transfer, validateProposal, type OwnerMethod, type Grant, type Ledger, type Proposal } from "./model";
import "./near.css";
import { actionCreators } from "@near-js/transactions";
import { assertRequestBinding, canComplete, completePending, persistPending, restorePending, type IntentRequest, type JournalRow } from "./pending";
type Row = JournalRow;
type Request = IntentRequest;
import { assertFundingNeeded, assertNoFundingAttempt, beginFunding, completeFunding, fundingAmount, parseFundingStatus, recordFundingHash, restoreFunding, type FundingAttempt, type FundingMethod, type FundingStatus } from "./funding";
import { nextStep, parseAccountSnapshot, type AccountSnapshot } from "./onboarding";
import { ReceiptLink } from "./ReceiptLink";
export default function NearApp() {
  const [owner, setOwner] = useState(""), [id, setId] = useState(new URLSearchParams(location.search).get("grant") ?? localStorage.getItem("near-grant") ?? ""), [grant, setGrant] = useState<Grant>(), [balance, setBalance] = useState<Ledger>(), [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [ready, setReady] = useState(false), [hours, setHours] = useState(8), [proposal, setProposal] = useState<Proposal>(), [request, setRequest] = useState<Request>(), [tick, setTick] = useState(Date.now());
  const [ownerFunding, setOwnerFunding] = useState<{ owner: string; status: FundingStatus }>(), [fundingAttempt, setFundingAttempt] = useState<FundingAttempt>(), [fundingHash, setFundingHash] = useState("");
  const [nativeAccount, setNativeAccount] = useState<AccountSnapshot>(), [signingEnabled, setSigningEnabled] = useState(false);
  async function run(fn: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await fn(); } catch (e) { if (e instanceof NearApiError && e.status === 401) { setOwner(""); setRows([]); setOwnerFunding(undefined); setNativeAccount(undefined); setProposal(undefined); } setError(e instanceof Error ? e.message : "Thao tác chưa hoàn tất."); } finally { setBusy(false); } }
  useEffect(() => { void run(async () => { const health = await api<{ chain: string; network: string; contractId: string; executorId: string; identityEnforced: boolean; signingEnabled: boolean }>("/health"); assertIdentity(health); setSigningEnabled(health.signingEnabled); setReady(true); const savedFunding = restoreFunding(localStorage); if (savedFunding) { setFundingAttempt(savedFunding); setFundingHash(savedFunding.hash ?? ""); } const savedRequest = restorePending(localStorage); if (savedRequest) setRequest(savedRequest); const account = await finishCallback(); if (account) setOwner(account); }); const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function refresh(account = owner) {
    // Clear stale views first; an RPC failure must not look like a current snapshot.
    setGrant(undefined); setBalance(undefined); setRows([]);
    let balanceOwner = account;
    let journal: Row[] = [];
    if (id) { const g = await api<{ value: Grant }>(`/near/grants/${encodeURIComponent(id)}`); setGrant(g.value); balanceOwner = g.value.owner; localStorage.setItem("near-grant", id); if (account && g.value.owner === account) journal = await api<Row[]>(`/near/transactions?grantId=${encodeURIComponent(id)}`); }
    if (account) { const own = await api<Row[]>("/near/owner-transactions"); setRows([...new Map([...journal, ...own].map(r => [r.hash, r])).values()]); }
    if (balanceOwner) setBalance((await api<{ value: Ledger }>(`/near/owners/${encodeURIComponent(balanceOwner)}/balance`)).value);
    if (account) await readFunding();
  }
  async function prepare(method: "create_grant" | "revoke_grant") {
    assertNoFundingAttempt(localStorage);
    if (method === "create_grant") {
      const status = await readFunding();
      if (!status.registered || BigInt(status.value.storage_available) < BigInt(MIN_OWNER_STORAGE) || BigInt(available(status.value)) < BigInt(CAP)) throw Error("Ví đăng nhập cần đủ storage và principal trước khi tạo grant. Dùng bước chuẩn bị vault bên dưới.");
    }
    const p = await api<Proposal>("/near/owner-actions", method === "create_grant" ? { method, policy: { spend_cap: CAP, max_transactions: 3, recipients: [PAYEE], expires_at_ns: ((BigInt(Date.now()) + BigInt(hours * 3600000)) * 1000000n).toString(), cooldown_ns: "0" } } : { method, grantId: id });
    await validateProposal(p, owner, method, id); setProposal(p); setMessage("Đề xuất chưa ký. Kiểm tra quyền bên dưới trước khi mở ví.");
  }
  async function sign() {
    if (!proposal) return;
    const method = proposal.transaction.actions[0].params.methodName as OwnerMethod;
    await validateProposal(proposal, owner, method, id);
    const w = await wallet();
    const accounts = await w.getAccounts(); if (accounts[0]?.accountId !== owner) throw Error("Ví đã đổi tài khoản. Đăng nhập lại.");
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
    if (!grant || request) return;
    if (grant.owner !== owner) throw Error("Grant này thuộc tài khoản khác; chỉ xem dữ liệu, chưa tạo intent cho ví đang đăng nhập.");
    if (kind === "replay" && BigInt(grant.next_nonce) === 0n) { setError("Cần có lượt nonce 0 đã xử lý trước khi thử replay. Nonce 0 hiện vẫn hợp lệ."); return; }
    // Persistence must succeed before the request can reach a submit button.
    setRequest(persistPending(localStorage, transfer(grant, id, kind)));
  }
  async function submit() {
    if (!request) return;
    assertRequestBinding(request, id, owner, grant);
    if (JSON.stringify(restorePending(localStorage)) !== JSON.stringify(request)) throw Error("Request trong trình duyệt đã thay đổi; khôi phục và kiểm tra trước khi gửi.");
    const response = await api<{ state: string; reason?: string; transactionHash?: string; finalized: boolean }>(`/near/grants/${encodeURIComponent(request.grant_id)}/intents`, request);
    setMessage(`${response.state}${response.reason ? ": " + response.reason : ""} · FINAL: ${response.finalized ? "có" : "chưa"}. ${response.transactionHash ?? ""}`);
    // Always retain identity, including after terminal response: repeated clicks retry the same intent.
    await refresh();
  }
  const left = grant ? remainingSeconds(grant, tick) : 0;
  const funds = ownerFunding?.owner === owner ? ownerFunding.status : undefined;
  const canCreateGrant = funds?.registered && BigInt(funds.value.storage_available) >= BigInt(MIN_OWNER_STORAGE) && BigInt(available(funds.value)) >= BigInt(CAP);
  const step = nextStep({ ready, owner, funds, grant, pendingFunding: !!fundingAttempt, pendingRequest: !!request, requestFinal: !!request && canComplete(request, rows), now: tick });
  return <main className="near-app">
    <header><a href="/near" className="near-brand">REDLINE <span>for NEAR</span></a><strong>NEAR TESTNET · chỉ mạng thử nghiệm</strong><a href="/" target="_blank" rel="noreferrer">Dashboard / Policy Lab Solana gốc ↗</a></header>
    <section className="near-hero"><p>AI SECURITY & DEFENSE</p><h1>Agent đề xuất.<br/>Chain giữ giới hạn.</h1><p>Ví chủ duyệt quyền. Executor chỉ gọi vault. Receipt và callback quyết định kết quả cuối cùng.</p><code>{CONTRACT}</code></section>
    <div aria-live="polite">{error && <p className="near-error" role="alert">{error}</p>}{message && <p className="near-notice">{message}</p>}{busy && <p>Đang xử lý… Giữ nguyên cửa sổ, không tạo request thay thế.</p>}</div>
    <section id="near-setup"><h2>Bắt đầu trên NEAR Testnet</h2><button disabled={busy} onClick={() => void run(async () => { const health = await api<{ chain: string; network: string; contractId: string; executorId: string; identityEnforced: boolean; signingEnabled: boolean }>("/health"); assertIdentity(health); setReady(true); setSigningEnabled(health.signingEnabled); })}>Kiểm tra kết nối API</button><p>{step.text}</p><a href={`#${step.target}`}>Đi đến bước cần làm ↓</a><p className="near-muted">{ready ? signingEnabled ? "API Testnet đã kết nối; executor đã cấu hình." : "API chỉ đọc: executor chưa cấu hình. Có thể xem bằng chứng, chưa gửi demo." : "Chưa xác minh được API Testnet."} Không dùng tài khoản .near Mainnet. Dashboard/Policy Lab gốc mở ở tab riêng và không điều khiển grant NEAR.</p><details><summary>Lần đầu chạy hoặc vừa đóng PowerShell</summary><ol><li>Backend: trong thư mục backend, chạy <code>.\scripts\start-near-local.ps1</code>, giữ cửa sổ mở.</li><li>Frontend: tại thư mục dự án, chạy <code>npm.cmd run dev -- --host localhost --port 5173 --strictPort</code>, giữ cửa sổ mở.</li><li>Mở <a href="http://localhost:5173/near">localhost:5173/near</a>. Cổng 8787 là API; trang gốc API trả 404 là bình thường.</li><li>Cho phép popup cho localhost. Trong Intear chọn tài khoản .testnet; đăng nhập chỉ ký thông điệp. Sau F5 cần đăng nhập lại.</li></ol><p>Cài đặt lần đầu cần Node/Postgres và executor do chủ tài khoản thiết lập theo README. Không nhập khóa riêng vào REDLINE.</p></details><ol><li>Đăng nhập → đọc vault → ký storage rồi principal nếu ví chưa có.</li><li>Tạo grant riêng → đọc snapshot FINAL → chuẩn bị và gửi ALLOW.</li><li>Chỉ sau kết quả FINAL mới chuyển sang cap / sai người nhận / replay → thu hồi → thử sau thu hồi.</li><li>Xem lịch sử, sao chép hash/link để kiểm chứng. Grant demo cũ đã thu hồi; không nạp lại để xem bằng chứng.</li></ol></section>
    <section><h2>Chỉ xem bằng chứng · không cần đăng nhập</h2><p>Bắt đầu bằng receipt lịch sử nếu bạn chưa có executor hoặc chưa muốn ký. Nạp demo mới cần chủ tài khoản thiết lập executor theo README.</p><button disabled={busy || !!request || !!fundingAttempt || !!proposal} onClick={() => { setId("grant-1b031438090c4fa1902eb9ddcbd1f47c"); setGrant(undefined); setBalance(undefined); setRows([]); setMessage("Đã chọn grant demo lịch sử. Bấm đọc snapshot FINAL; grant đã thu hồi, không tạo quyền mới để xem bằng chứng."); }}>Chọn grant demo đã thu hồi</button><a href="#near-proofs">Xem các receipt đã xác minh ↓</a></section><div className="near-grid"><section id="near-owner"><h2>1. Đăng nhập và duyệt quyền</h2>
    <p role="status">{owner ? `Đã đăng nhập: ${owner}` : "Chưa đăng nhập"}</p>
    {!owner ? <button disabled={busy || !ready} onClick={() => void run(async () => setOwner(await login()))}>Đăng nhập ví Testnet · NEP-413</button> :
      <button disabled={busy} onClick={() => void run(async () => { await api("/near/auth/logout", {}); setToken(""); setOwner(""); setRows([]); setProposal(undefined); setOwnerFunding(undefined); setNativeAccount(undefined); })}>Đăng xuất</button>}
    <p className="near-muted">{owner ? "Đăng nhập không cấp quyền chuyển tiền. Giao dịch của chủ ví vẫn cần xem lại và ký riêng." : "Kết nối tài khoản Intear Wallet Testnet. Đăng nhập chỉ ký thông điệp, không chuyển tiền."}</p>
    <a href="https://wallet.intear.tech/" target="_blank" rel="noreferrer">Mở Intear Wallet ↗</a>
    <button disabled={busy || !owner || !ready} onClick={() => void run(readNativeAccount)}>Đọc số dư tài khoản ví</button>
    {nativeAccount?.accountId === owner && <p>Số dư tài khoản: <b>{near(nativeAccount.amount)} NEAR Testnet</b> · đang khóa {near(nativeAccount.locked)} NEAR · FINAL block {nativeAccount.blockHeight}. Số này chưa trừ yêu cầu lưu trữ của tài khoản; không phải tiền trong vault hay mức gas có thể chi.</p>}
    <h3>Chuẩn bị vault cho ví đăng nhập</h3>
    <p>Mỗi tài khoản có storage và principal riêng. Bước đầu đề xuất 0,05 NEAR Testnet cho storage, rồi 0,1 NEAR Testnet principal. Mỗi khoản cần bạn xem lại và ký riêng; chưa có thao tác tự động nạp tiền.</p>
    <button disabled={busy || !owner || !ready} onClick={() => void run(async () => { await readFunding(); })}>Đọc vault của ví đăng nhập</button>
    {ownerFunding?.owner === owner && <p>{ownerFunding.status.registered ? `Ví ${owner}: storage ${near(ownerFunding.status.value.storage_available)} NEAR; principal khả dụng ${near(available(ownerFunding.status.value))} NEAR.` : `Ví ${owner} chưa đăng ký storage trong vault.`}</p>}
    <button disabled={busy || !owner || !ready || !!fundingAttempt || (funds?.registered && BigInt(funds.value.storage_available) >= BigInt(MIN_OWNER_STORAGE))} onClick={() => void run(() => prepareFunding("storage_deposit"))}>Xem đề xuất storage 0,05 NEAR</button>
    <button disabled={busy || !owner || !ready || !!fundingAttempt || !funds?.registered || funds.value.credited !== "0"} onClick={() => void run(() => prepareFunding("deposit"))}>Xem đề xuất principal 0,1 NEAR</button>
    <button disabled={busy || !owner} onClick={() => void run(async () => { const saved = restoreFunding(localStorage); if (!saved || saved.owner !== owner) throw Error("Không có funding đã lưu cho tài khoản đang đăng nhập."); setFundingAttempt(saved); setFundingHash(saved.hash ?? ""); })}>Khôi phục lần ký funding</button>
    {fundingAttempt && <div className="near-review"><p>Funding cần đối soát: {fundingAttempt.method} · {near(fundingAttempt.amount)} NEAR Testnet. Giữ nguyên lần ký, chưa ký lại.</p><label>Transaction hash công khai (lấy từ kết quả hoặc lịch sử ví)<input value={fundingHash} onChange={e => setFundingHash(e.target.value)} /></label><button disabled={busy || !owner || !fundingHash} onClick={() => void run(async () => { const saved = recordFundingHash(localStorage, fundingAttempt, fundingHash.trim()); setFundingAttempt(saved); await reconcileOwnerFunding(saved); })}>Đối soát funding · không ký</button><p>Nếu đã hủy trước khi ký hoặc không có hash, dừng để kiểm tra; không xóa bản ghi và nạp lại chỉ vì timeout.</p></div>}
    <label>Hạn grant <select value={hours} onChange={e => setHours(Number(e.target.value))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} giờ</option>)}</select></label><p>Tổng cap <b>0,05 NEAR</b> · tối đa 3 lượt · chỉ <code>{PAYEE}</code>.</p><button disabled={busy || !owner || !ready || !canCreateGrant || !!fundingAttempt} onClick={() => void run(() => prepare("create_grant"))}>Chuẩn bị quyền mới</button>
    {proposal && <div className="near-review"><h3>Xem lại trước khi ký</h3><p>Phương thức: {proposal.transaction.actions[0].params.methodName}. Khoản gửi kèm: <b>{near(proposal.transaction.actions[0].params.deposit)} NEAR Testnet</b>, chưa gồm gas. Thời hạn grant tính từ lúc chuẩn bị; đăng nhập lại không gia hạn.</p><pre>{JSON.stringify(proposal, null, 2)}</pre><button disabled={busy || !!fundingAttempt} onClick={() => void run(sign)}>Tôi đã xem · Mở ví ký Testnet</button><button onClick={() => setProposal(undefined)}>Hủy đề xuất</button></div>}</section>
    <section id="near-grant"><h2>2. Vault và quyền hiện tại</h2><label>Grant ID<input value={id} onChange={e => { setId(e.target.value); setGrant(undefined); setBalance(undefined); setRows([]); }} /></label><button disabled={busy || !ready} onClick={() => void run(() => refresh())}>Đọc snapshot FINAL</button>{grant && <><p>Owner: <code>{grant.owner}</code>{owner && owner !== grant.owner && " (read-only)"}</p><p>{grant.active ? left > 0 ? "Đang có hiệu lực" : "Hết hạn" : "Đã thu hồi"} · còn {Math.floor(left / 3600)}h {Math.floor(left % 3600 / 60)}m {Math.floor(left % 60)}s</p><p>Cap còn: <b>{near((BigInt(grant.policy.spend_cap) - BigInt(grant.finalized_spent) - BigInt(grant.pending_reserved)).toString())} NEAR</b></p><p>Đã chi {near(grant.finalized_spent)} · đang giữ {near(grant.pending_reserved)} · nonce {grant.next_nonce}</p><p>Deadline: {new Date(Number(BigInt(grant.policy.expires_at_ns) / 1000000n)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (UTC+7)</p><button disabled={busy || owner !== grant.owner || !grant.active} onClick={() => void run(() => prepare("revoke_grant"))}>Xem đề xuất thu hồi</button></>}{balance && <p>Principal khả dụng: <b>{near(available(balance))} NEAR</b> · storage riêng: {near(balance.storage_available)} NEAR</p>}<p className="near-muted">Thu hồi chặn ý định mới; transfer đã dispatch vẫn chờ callback. Nút refresh đọc snapshot mới, không tự polling RPC.</p></section></div>
    <section id="near-intents"><h2>3. Thử giới hạn với request có thể kiểm tra</h2><p>Các nút chỉ chuẩn bị JSON. Gửi là giao dịch Testnet thật, executor trả phí gas/storage kể cả bị từ chối. ALLOW chuyển 0,01 NEAR.</p><div className="near-actions">{([['allow','ALLOW 0,01 NEAR'],['cap','Vượt cap'],['recipient','Sai người nhận'],['replay','Replay nonce 0']] as const).map(([kind,label]) => <button key={kind} disabled={busy || !grant || !owner || grant.owner !== owner || !!request} onClick={() => void run(async () => prepareIntent(kind))}>{label}</button>)}<button disabled={busy || !!request} onClick={() => void run(async () => { const saved = restorePending(localStorage); if (!saved) throw Error("Không có request đã lưu."); setRequest(saved); })}>Khôi phục request sau reload</button></div>
    {request && <div className="near-review"><pre>{JSON.stringify(request, null, 2)}</pre><button disabled={busy || !owner || !ready || !signingEnabled} onClick={() => void run(submit)}>Gửi / đối soát cùng intent</button><p>Giữ nguyên intent khi UNKNOWN/PENDING. Nếu tải lại trang, dùng khôi phục request. Không tạo ID mới để thử lại.</p><button disabled={busy || !canComplete(request, rows)} onClick={() => void run(async () => { completePending(localStorage, request, rows); setRequest(undefined); })}>Đã có kết quả cuối · Chuẩn bị case tiếp</button></div>}</section>
    <section id="near-history"><h2>4. Lịch sử và receipt</h2><button disabled={busy || !owner || !ready} onClick={() => void run(async () => { const own = await api<Row[]>("/near/owner-transactions"); setRows(current => [...new Map([...current, ...own].map(r => [r.hash, r])).values()]); })}>Đọc lịch sử giao dịch chủ ví</button><p>SETTLED là callback đã xác nhận transfer; UNKNOWN/PENDING chưa chứng minh chuyển tiền thành công. Đây là journal của chủ grant, không phải toàn bộ lịch sử chain.</p>{rows.length === 0 ? <p>Chưa tải lịch sử. Đăng nhập và đọc grant để xem.</p> : <div className="near-table"><table><thead><tr><th>Intent</th><th>Trạng thái</th><th>Lý do</th><th>Receipt</th></tr></thead><tbody>{rows.map(r => <tr key={r.hash}><td>{r.intentId ?? "Owner action"}</td><td>{r.state}</td><td>{r.reason ?? "—"}</td><td><ReceiptLink hash={r.hash} /><button disabled={busy} onClick={() => void run(async () => { await api("/near/transactions/track", { hash: r.hash, signerId: r.signerId ?? (r.intentId ? "nhat-redline-agent.testnet" : owner) }); await refresh(); })}>Đối soát FINAL</button></td></tr>)}</tbody></table></div>}<p className="near-muted">Demo tấn công là JSON có kiểm soát; không gắn nhãn là LLM tự thực hiện. Kiểm thử concurrency/callback lỗi hiện có bằng chứng sandbox riêng.</p></section>
    <section id="near-proofs"><h2>Bằng chứng Testnet đã đối chiếu</h2><p>Chín giao dịch của demo qua trình duyệt đã có receipt FINAL được đối chiếu độc lập, gồm nạp tiền, tạo grant, ALLOW, từ chối và thu hồi. Đây là bằng chứng lịch sử, không phải trạng thái một request mới. Luồng ví được chủ dự án chạy trực tiếp; chưa coi là kiểm thử trình duyệt tự động.</p><ul>{[
      ["Browser · storage 0,05 NEAR", "3HWgnSzk6Zo1Q87zaoKYLjvqTnbKYbNHEqmRD13Ud14Z"],
      ["Browser · principal 0,1 NEAR", "7F4EigWDUF8X8TNQcqhQ4m8H8h7syNV8MdEt8vKKzS3x"],
      ["Browser · tạo grant", "7UKKxLJyiFJLiBLr92CRbe8gP21czuv5ru8Du9bWXLM3"],
      ["Browser · thu hồi grant", "2XojCUvx1QLkA1tsPKS4AM8tacjQjp3Ubv6ZJLFcfJVd"],
      ["Browser · SPEND_CAP_EXCEEDED", "CX71RxEViVW2xrVxQBtELiPNic8NwCMchoxwxhvfymtX"],
      ["Browser · DESTINATION_NOT_ALLOWED", "GympRgkPjYkNLa6NTDp6eaALgh5hTiHnhNi6T7PYJ5pX"],
      ["Browser · ALLOW 0,01 NEAR · SETTLED", "6dQsYKnAqx3y5bQYwSHD3LeVktSpMiKSnX9LLV6VRZoe"],
      ["Browser · NONCE_REPLAY", "9LdgMWE3aE7PJ3vHa9veApZ6yFdRstVfwKRPdS9fdV1w"],
      ["Browser · REVOKED", "FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP"],
      ["Scoped API · ALLOW 0,01 NEAR · callback SETTLED", "GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ"],
      ["CLI · ALLOW 0,05 NEAR · callback SETTLED", "3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1"],
      ["CLI · SPEND_CAP_EXCEEDED", "J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x"],
      ["CLI · DESTINATION_NOT_ALLOWED", "8MCrqH1rQXTPvfuG6Yk9TuAVXgGo7mj55rmfMvNL9DuB"],
      ["CLI · REVOKED", "4huc1hEC2EF3jEft21Ga7xBvoFMCuvzsCTsiLWJkGBU4"],
      ["Scoped API · EXPIRED · tiền gốc không đổi", "Gqv1YhjYHr9ZVkLnEscPmHFSAWDZ5TcgHhCUxvPPmxGQ"],
    ].map(([label, hash]) => <li key={hash}><a target="_blank" rel="noreferrer" href={`https://explorer.testnet.near.org/transactions/${hash}`}>{label} ↗</a></li>)}</ul></section>
  </main>;
}
