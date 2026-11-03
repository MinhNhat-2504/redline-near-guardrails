import { useEffect, useState } from "react";
import { api, setToken } from "./api";
import { finishCallback, login, wallet } from "./wallet";
import { available, CAP, CONTRACT, PAYEE, assertIdentity, near, remainingSeconds, transfer, validateProposal, type Grant, type Ledger, type Proposal } from "./model";
import "./near.css";
import { actionCreators } from "@near-js/transactions";
import { assertRequestBinding, canComplete, completePending, persistPending, restorePending, type IntentRequest, type JournalRow } from "./pending";
type Row = JournalRow;
type Request = IntentRequest;
export default function NearApp() {
  const [owner, setOwner] = useState(""), [id, setId] = useState(new URLSearchParams(location.search).get("grant") ?? localStorage.getItem("near-grant") ?? ""), [grant, setGrant] = useState<Grant>(), [balance, setBalance] = useState<Ledger>(), [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [ready, setReady] = useState(false), [hours, setHours] = useState(8), [proposal, setProposal] = useState<Proposal>(), [request, setRequest] = useState<Request>(), [tick, setTick] = useState(Date.now());
  async function run(fn: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Thao tác chưa hoàn tất."); } finally { setBusy(false); } }
  useEffect(() => { void run(async () => { assertIdentity(await api("/health")); setReady(true); const account = await finishCallback(); if (account) setOwner(account); }); const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function refresh(account = owner) {
    // Clear stale views first; an RPC failure must not look like a current snapshot.
    setGrant(undefined); setBalance(undefined); setRows([]);
    let balanceOwner = account;
    if (id) { const g = await api<{ value: Grant }>(`/near/grants/${encodeURIComponent(id)}`); setGrant(g.value); balanceOwner = g.value.owner; localStorage.setItem("near-grant", id); if (account && g.value.owner === account) setRows(await api<Row[]>(`/near/transactions?grantId=${encodeURIComponent(id)}`)); }
    if (balanceOwner) setBalance((await api<{ value: Ledger }>(`/near/owners/${encodeURIComponent(balanceOwner)}/balance`)).value);
  }
  async function prepare(method: "create_grant" | "revoke_grant") {
    const p = await api<Proposal>("/near/owner-actions", method === "create_grant" ? { method, policy: { spend_cap: CAP, max_transactions: 3, recipients: [PAYEE], expires_at_ns: ((BigInt(Date.now()) + BigInt(hours * 3600000)) * 1000000n).toString(), cooldown_ns: "0" } } : { method, grantId: id });
    await validateProposal(p, owner, method, id); setProposal(p); setMessage("Đề xuất chưa ký. Kiểm tra quyền bên dưới trước khi mở ví.");
  }
  async function sign() {
    if (!proposal) return;
    const method = proposal.transaction.actions[0].params.methodName as "create_grant" | "revoke_grant";
    await validateProposal(proposal, owner, method, id);
    const w = await wallet();
    const accounts = await w.getAccounts(); if (accounts[0]?.accountId !== owner) throw Error("Ví đã đổi tài khoản. Đăng nhập lại.");
    if (method === "create_grant") { const newId = proposal.transaction.actions[0].params.args.grant_id as string; setId(newId); localStorage.setItem("near-grant", newId); }
    const result = await w.signAndSendTransaction({ signerId: owner, receiverId: proposal.transaction.receiverId, actions: proposal.transaction.actions.map(a => actionCreators.functionCall(a.params.methodName, a.params.args, BigInt(a.params.gas), BigInt(a.params.deposit))) });
    setProposal(undefined);
    setMessage("Ví đã xử lý yêu cầu. Chưa coi là SETTLED; kiểm tra FINAL qua lịch sử.");
    if (result) await api("/near/transactions/track", { hash: result.transaction.hash, signerId: owner });
  }
  function prepareIntent(kind: "allow" | "cap" | "recipient" | "replay") {
    if (!grant || request) return;
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
  return <main className="near-app">
    <header><a href="/near" className="near-brand">REDLINE <span>for NEAR</span></a><strong>TESTNET · native NEAR</strong><a href="/">Solana gốc</a></header>
    <section className="near-hero"><p>AI SECURITY & DEFENSE</p><h1>Agent đề xuất.<br/>Chain giữ giới hạn.</h1><p>Ví chủ duyệt quyền. Executor chỉ gọi vault. Receipt và callback quyết định kết quả cuối cùng.</p><code>{CONTRACT}</code></section>
    <div aria-live="polite">{error && <p className="near-error" role="alert">{error}</p>}{message && <p className="near-notice">{message}</p>}{busy && <p>Đang xử lý… Giữ nguyên cửa sổ, không tạo request thay thế.</p>}</div>
    <div className="near-grid"><section><h2>1. Đăng nhập và duyệt quyền</h2><p>{owner || "Chưa đăng nhập"}</p><button disabled={busy || !ready} onClick={() => void run(async () => setOwner(await login()))}>Đăng nhập ví Testnet · NEP-413</button>{owner && <button disabled={busy} onClick={() => void run(async () => { await api("/near/auth/logout", {}); setToken(""); setOwner(""); setRows([]); setProposal(undefined); })}>Đăng xuất</button>}<p className="near-muted">Dùng tài khoản có sẵn trong MyNearWallet Testnet. Đăng nhập chỉ ký thông điệp, không chuyển tiền. Chưa kiểm chứng luồng ví thật trên trình duyệt này.</p>
    <label>Hạn grant <select value={hours} onChange={e => setHours(Number(e.target.value))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} giờ</option>)}</select></label><p>Tổng cap <b>0,05 NEAR</b> · tối đa 3 lượt · chỉ <code>{PAYEE}</code>.</p><button disabled={busy || !owner || !ready} onClick={() => void run(() => prepare("create_grant"))}>Chuẩn bị quyền mới</button>
    {proposal && <div className="near-review"><h3>Xem lại trước khi ký</h3><p>Không kèm deposit. Thời hạn tính từ lúc chuẩn bị; đăng nhập lại không gia hạn grant.</p><pre>{JSON.stringify(proposal, null, 2)}</pre><button disabled={busy} onClick={() => void run(sign)}>Tôi đã xem · Mở ví ký Testnet</button><button onClick={() => setProposal(undefined)}>Hủy đề xuất</button></div>}</section>
    <section><h2>2. Vault và quyền hiện tại</h2><label>Grant ID<input value={id} onChange={e => { setId(e.target.value); setGrant(undefined); setBalance(undefined); setRows([]); }} /></label><button disabled={busy || !ready} onClick={() => void run(() => refresh())}>Đọc snapshot FINAL</button>{grant && <><p>{grant.active ? left > 0 ? "Đang có hiệu lực" : "Hết hạn" : "Đã thu hồi"} · còn {Math.floor(left / 3600)}h {Math.floor(left % 3600 / 60)}m {Math.floor(left % 60)}s</p><p>Cap còn: <b>{near((BigInt(grant.policy.spend_cap) - BigInt(grant.finalized_spent) - BigInt(grant.pending_reserved)).toString())} NEAR</b></p><p>Đã chi {near(grant.finalized_spent)} · đang giữ {near(grant.pending_reserved)} · nonce {grant.next_nonce}</p><p>Deadline: {new Date(Number(BigInt(grant.policy.expires_at_ns) / 1000000n)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (UTC+7)</p><button disabled={busy || owner !== grant.owner || !grant.active} onClick={() => void run(() => prepare("revoke_grant"))}>Xem đề xuất thu hồi</button></>}{balance && <p>Principal khả dụng: <b>{near(available(balance))} NEAR</b> · storage riêng: {near(balance.storage_available)} NEAR</p>}<p className="near-muted">Thu hồi chặn ý định mới; transfer đã dispatch vẫn chờ callback. Nút refresh đọc snapshot mới, không tự polling RPC.</p></section></div>
    <section><h2>3. Thử giới hạn với request có thể kiểm tra</h2><p>Các nút chỉ chuẩn bị JSON. Gửi là giao dịch Testnet thật, executor trả phí gas/storage kể cả bị từ chối. ALLOW chuyển 0,01 NEAR.</p><div className="near-actions">{([['allow','ALLOW 0,01 NEAR'],['cap','Vượt cap'],['recipient','Sai người nhận'],['replay','Replay nonce 0']] as const).map(([kind,label]) => <button key={kind} disabled={busy || !grant || !owner || !!request} onClick={() => void run(async () => prepareIntent(kind))}>{label}</button>)}<button disabled={busy || !!request} onClick={() => void run(async () => { const saved = restorePending(localStorage); if (!saved) throw Error("Không có request đã lưu."); setRequest(saved); })}>Khôi phục request sau reload</button></div>
    {request && <div className="near-review"><pre>{JSON.stringify(request, null, 2)}</pre><button disabled={busy || !owner || !ready} onClick={() => void run(submit)}>Gửi / đối soát cùng intent</button><p>Giữ nguyên intent khi UNKNOWN/PENDING. Nếu tải lại trang, dùng khôi phục request. Không tạo ID mới để thử lại.</p><button disabled={busy || !canComplete(request, rows)} onClick={() => void run(async () => { completePending(localStorage, request, rows); setRequest(undefined); })}>Đã có kết quả cuối · Chuẩn bị case tiếp</button></div>}</section>
    <section><h2>4. Lịch sử và receipt</h2><p>SETTLED là callback đã xác nhận transfer; UNKNOWN/PENDING chưa chứng minh chuyển tiền thành công. Đây là journal của chủ grant, không phải toàn bộ lịch sử chain.</p>{rows.length === 0 ? <p>Chưa tải lịch sử. Đăng nhập và đọc grant để xem.</p> : <div className="near-table"><table><thead><tr><th>Intent</th><th>Trạng thái</th><th>Lý do</th><th>Receipt</th></tr></thead><tbody>{rows.map(r => <tr key={r.hash}><td>{r.intentId ?? "Owner action"}</td><td>{r.state}</td><td>{r.reason ?? "—"}</td><td><a target="_blank" rel="noreferrer" href={`https://explorer.testnet.near.org/transactions/${encodeURIComponent(r.hash)}`}>Mở Explorer ↗</a><button disabled={busy} onClick={() => void run(async () => { await api("/near/transactions/track", { hash: r.hash, signerId: r.intentId ? "nhat-redline-agent.testnet" : owner }); await refresh(); })}>Đối soát FINAL</button></td></tr>)}</tbody></table></div>}<p className="near-muted">Demo tấn công là JSON có kiểm soát; không gắn nhãn là LLM tự thực hiện. Kiểm thử concurrency/callback lỗi hiện có bằng chứng sandbox riêng.</p></section>
    <section><h2>Bằng chứng Testnet đã đối chiếu</h2><p>Các giao dịch lịch sử này đã được kiểm tra độc lập trong hồ sơ repo. ALLOW qua API đã xác minh callback SETTLED, payee tăng 0,01 NEAR và pending bằng 0. Đây là bằng chứng backend; luồng ký ví trình duyệt vẫn cần kiểm chứng riêng.</p><ul>{[
      ["Scoped API · ALLOW 0,01 NEAR · callback SETTLED", "GDDHqqikTtpuH3dcrosMJDDbaXuFf2QkLMvcFh9wPXUZ"],
      ["CLI · ALLOW 0,05 NEAR · callback SETTLED", "3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1"],
      ["CLI · SPEND_CAP_EXCEEDED", "J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x"],
      ["CLI · DESTINATION_NOT_ALLOWED", "8MCrqH1rQXTPvfuG6Yk9TuAVXgGo7mj55rmfMvNL9DuB"],
      ["CLI · REVOKED", "4huc1hEC2EF3jEft21Ga7xBvoFMCuvzsCTsiLWJkGBU4"],
      ["Scoped API · EXPIRED · tiền gốc không đổi", "Gqv1YhjYHr9ZVkLnEscPmHFSAWDZ5TcgHhCUxvPPmxGQ"],
    ].map(([label, hash]) => <li key={hash}><a target="_blank" rel="noreferrer" href={`https://explorer.testnet.near.org/transactions/${hash}`}>{label} ↗</a></li>)}</ul></section>
  </main>;
}
