import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Overview, pageForTarget, pageFromHash, StatusBadge, Workspace, workspacePages } from "./Workspace";
import { ProposalReview } from "./Review";
import { ProofGallery, browserProofs, demoCases, DemoWalkthrough, DemoCaseContent } from "./ProofGallery";
import { copyReceiptText } from "./clipboard";
import { CONTRACT, PAYEE, type Grant, type Ledger, type Proposal } from "./model";
import { explorerUrl } from "./onboarding";
import NearApp from "./NearApp";
import { QuickGuide } from "./QuickGuide";
import { ConnectionStatus } from "./ConnectionStatus";
const grant: Grant = { owner: "owner.testnet", active: false, next_nonce: "1", finalized_spent: "10000000000000000000000", pending_reserved: "0", finalized_transactions: 1, pending_transactions: 0, policy: { executor: "executor.testnet", policy_hash: "a".repeat(64), spend_cap: "50000000000000000000000", max_transactions: 3, recipients: [PAYEE], expires_at_ns: "1793778862645000000", cooldown_ns: "0" } };
const balance: Ledger = { credited: "100000000000000000000000", finalized_spent: "10000000000000000000000", pending_reserved: "0", pending_withdrawals: "0", completed_withdrawals: "0", storage_available: "44980000000000000000000" };
afterEach(() => vi.unstubAllGlobals());
describe("NEAR workspace navigation and display safety (render tests, not browser E2E)", () => {
  it("exposes a labelled collapsed mobile menu control without signing on render", () => {
    const navigate = vi.fn(), onWallet = vi.fn();
    const html = renderToStaticMarkup(<Workspace page="activity" owner="" ready busy={false} navigate={navigate} onWallet={onWallet}>History</Workspace>);
    expect(html).toContain('aria-expanded="false"'); expect(html).toContain('aria-controls="near-primary-navigation"');
    expect(html).toContain('id="near-primary-navigation"'); expect(html).toContain('aria-label="Các trang NEAR"');
    expect(navigate).not.toHaveBeenCalled(); expect(onWallet).not.toHaveBeenCalled();
  });
  it.each(workspacePages)("recognizes direct link to $id without wallet actions", p => { expect(pageFromHash(`#/${p.id}`)).toBe(p.id); });
  it("does not interpret NEP413 signature fragments as application routes", () => {
    expect(pageFromHash("#accountId=owner.testnet&signature=private&state=state")).toBe("overview");
    expect(pageFromHash("#/mainnet")).toBe("overview"); expect(pageFromHash("#near-history")).toBe("activity");
    expect(pageForTarget("near-intents")).toBe("activity"); expect(pageForTarget("near-owner")).toBe("vault");
  });
  it("renders original REDLINE navigation identity without loading Solana providers", () => {
    const navigate = vi.fn(), onWallet = vi.fn();
    const html = renderToStaticMarkup(<Workspace page="vault" owner="owner.testnet" ready busy={false} navigate={navigate} onWallet={onWallet}><p>Vault content</p></Workspace>);
    expect(html).toContain("REDLINE"); expect(html).toContain("NEAR Testnet"); expect(html).toContain('aria-current="page"'); expect(html).toContain("owner.testnet");
    expect(html).toContain("Vault content"); expect(html).toContain('href="/"'); expect(html).toContain('target="_blank"');
    expect(navigate).not.toHaveBeenCalled(); expect(onWallet).not.toHaveBeenCalled();
  });
  it("unloaded balances remain unknown, not fake zero or fabricated chart values", () => {
    const html = renderToStaticMarkup(<Overview owner="" ready={false} hasPending={false} nextText="Connect" nextTarget="near-setup" navigate={vi.fn()} onDemo={vi.fn()} demoBlocked={false} />);
    expect(html).toContain("—"); expect(html).toContain("Chưa tải"); expect(html).not.toContain("0 NEAR");
    expect(html).toContain("redline-celestial-vault-hero.webp"); expect(html).toContain("redline-treasury-core.webp");
    expect(html).toContain("không ký hoặc chuyển tiền");
  });
  it("keeps the product explanation and evidence entry usable without API or a wallet", () => {
    const navigate = vi.fn(), onDemo = vi.fn();
    const html = renderToStaticMarkup(<Overview owner="" ready={false} hasPending={false} nextText="Connect" nextTarget="near-setup" navigate={navigate} onDemo={onDemo} demoBlocked />);
    expect(html).toContain("Cho AI ngân sách."); expect(html).toContain("DÙNG KHI NÀO?");
    expect(html).toContain("chưa có trợ lý tự mua dịch vụ"); expect(html).toContain("Không cần đăng nhập hoặc kết nối API");
    expect(html).toMatch(/<button class="nw-primary">Xem demo: được phép hay bị chặn/);
    expect(onDemo).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
  });
  it("binds the guided examples to the exact existing financial evidence, with no new execution", () => {
    expect(demoCases.map(c => browserProofs[c.proofIndex].state)).toEqual(["SETTLED", "REJECTED", "REJECTED", "REJECTED"]);
    expect(demoCases.map(c => browserProofs[c.proofIndex].hash)).toEqual([browserProofs[3].hash, browserProofs[4].hash, browserProofs[5].hash, browserProofs[8].hash]);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const html = renderToStaticMarkup(<DemoWalkthrough />);
    expect(html).toContain(explorerUrl(browserProofs[3].hash)); expect(html).toContain("Đã chuyển 0,01 NEAR");
    expect(html).toContain('aria-pressed="true"'); expect(html).toContain('aria-live="polite"');
    expect(html).toContain("giao dịch Testnet lịch sử"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("explains newcomer and uncertain-result paths without inviting another payment", () => {
    const navigate = vi.fn(); const html = renderToStaticMarkup(<QuickGuide navigate={navigate} />);
    expect(html).toContain("Chưa ký lại, nạp lại hoặc tạo yêu cầu thay thế");
    expect(html).toContain("PENDING hoặc UNKNOWN chưa xác nhận thành công");
    expect(html).toContain("AI giải thích không tự ký hay chuyển tiền");
    expect(html).not.toContain('<details open'); expect(navigate).not.toHaveBeenCalled();
  });
  it.each(demoCases.map((item, index) => ({ ...item, index })))("renders English evidence for $name with the original exact receipt", item => {
    const onSelect = vi.fn(), fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const html = renderToStaticMarkup(<DemoCaseContent language="en" selected={item.index} onSelect={onSelect} />);
    expect(html).toContain('lang="en"'); expect(html).toContain(explorerUrl(browserProofs[item.proofIndex].hash));
    expect(html).toContain("historical Testnet transactions"); expect(html).toContain("cannot sign, create permissions or override the contract");
    expect(html).toContain(item.blocked ? "Blocked:" : "0.01 NEAR transferred");
    expect(onSelect).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("falls back to the first historical case for an invalid display selection", () => {
    const html = renderToStaticMarkup(<DemoCaseContent language="en" selected={-1} onSelect={vi.fn()} />);
    expect(html).toContain(explorerUrl(browserProofs[3].hash)); expect(html).not.toContain("undefined");
  });
  it.each([true, false])("keeps API status %s distinct from transaction settlement and makes no request on render", ready => {
    const onCheck = vi.fn(); const html = renderToStaticMarkup(<ConnectionStatus ready={ready} busy={false} onCheck={onCheck} />);
    expect(html).toContain(ready ? "API Testnet đã kết nối" : "Demo lịch sử vẫn mở được");
    expect(html).not.toContain("SETTLED"); expect(onCheck).not.toHaveBeenCalled();
    if (!ready) expect(html).toContain("Kiểm tra kết nối");
  });
  it("shows exact snapshot principal excluding storage and labels revoked grant", () => {
    const html = renderToStaticMarkup(<Overview owner={grant.owner} grant={grant} balance={balance} ready hasPending nextText="Keep same intent" nextTarget="near-intents" navigate={vi.fn()} onDemo={vi.fn()} demoBlocked />);
    expect(html).toContain("0.09"); expect(html).toContain("Đã thu hồi"); expect(html).toContain("CẦN ĐỐI SOÁT"); expect(html).toContain(grant.owner);
    expect(html).not.toContain("0.13498");
  });
  it.each(["SETTLED", "REJECTED", "FAILED", "UNKNOWN", "PENDING"])("keeps %s distinct instead of treating unknown as settled", state => {
    const html = renderToStaticMarkup(<StatusBadge state={state} />); expect(html).toContain(state);
    if (["UNKNOWN", "PENDING"].includes(state)) expect(html).not.toContain("nw-badge-success");
  });
  it("every one of the nine historical proof cards links to the exact Testnet receipt", () => {
    expect(new Set(browserProofs.map(p => p.hash)).size).toBe(9);
    const html = renderToStaticMarkup(<ProofGallery />);
    for (const proof of browserProofs) expect(html).toContain(explorerUrl(proof.hash));
    expect(html).toContain("không phải kiểm thử trình duyệt tự động"); expect(html).not.toContain("solscan");
  });
  it("review exposes signer, receiver, exact deposit and separate wallet step; JSON collapsed", () => {
    const proposal: Proposal = { network: "testnet", signerId: grant.owner, unsigned: true, transaction: { receiverId: CONTRACT, actions: [{ type: "FunctionCall", params: { methodName: "create_grant", args: { grant_id: "g", policy: grant.policy }, gas: "100000000000000", deposit: "0" } }] } };
    const onSign = vi.fn(), onCancel = vi.fn(); const html = renderToStaticMarkup(<ProposalReview proposal={proposal} busy blocked onSign={onSign} onCancel={onCancel} />);
    expect(html).toContain(grant.owner); expect(html).toContain(CONTRACT); expect(html).toContain(PAYEE); expect(html).toContain("0.05 NEAR");
    expect(html).toContain("chưa ký hoặc gửi"); expect(html).toContain("disabled"); expect(html).not.toContain('<details open'); expect(onSign).not.toHaveBeenCalled(); expect(onCancel).not.toHaveBeenCalled();
  });
  it.each(workspacePages)("renders direct $id route with one visible workspace and no financial transport", page => {
    vi.stubGlobal("location", { pathname: "/near", search: "", hash: `#/${page.id}` });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const html = renderToStaticMarkup(<NearApp />);
    expect(html).toContain('class="nw-sidebar"'); expect(html).toContain('class="nw-content"');
    expect(html).toContain("NEAR Testnet"); expect(html).toContain('id="near-workspace-content"');
    expect((html.match(/hidden=""/g) ?? []).length).toBe(6);
    expect(html).not.toContain("NaN"); expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("clipboard permission denied path (synthetic transport)", () => {
  it("returns the exact link as a selectable fallback, not only its transaction hash", async () => {
    const url = explorerUrl(browserProofs[8].hash);
    expect(await copyReceiptText(url, { writeText: async () => { throw Error("NotAllowedError"); } })).toEqual({ copied: false, fallback: url });
    expect(await copyReceiptText(url)).toEqual({ copied: false, fallback: url });
  });
  it("copies exactly the requested text and clears fallback after success", async () => {
    const writeText = vi.fn(async () => {}); expect(await copyReceiptText(browserProofs[8].hash, { writeText })).toEqual({ copied: true, fallback: "" });
    expect(writeText).toHaveBeenCalledWith(browserProofs[8].hash);
  });
});
