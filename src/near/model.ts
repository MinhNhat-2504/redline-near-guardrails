export const CONTRACT = "nhat-redline-vault.testnet";
export const EXECUTOR = "nhat-redline-agent.testnet";
export const PAYEE = "nhat-redline-payee.testnet";
export const CAP = "50000000000000000000000";
export const STORAGE_FUNDING = "50000000000000000000000", PRINCIPAL_FUNDING = "100000000000000000000000", MIN_OWNER_STORAGE = "10000000000000000000000";
export type OwnerMethod = "create_grant" | "revoke_grant" | "storage_deposit" | "deposit";
export type Grant = { owner: string; active: boolean; next_nonce: string; finalized_spent: string; pending_reserved: string; finalized_transactions: number; pending_transactions: number; policy: { executor: string; policy_hash: string; spend_cap: string; max_transactions: number; recipients: string[]; expires_at_ns: string; cooldown_ns: string } };
export type Ledger = { credited: string; finalized_spent: string; pending_reserved: string; completed_withdrawals: string; pending_withdrawals: string; storage_available: string };
export function near(value: string): string {
  const n = BigInt(value), sign = n < 0n ? "-" : "", absolute = n < 0n ? -n : n;
  return sign + (absolute / 10n ** 24n) + ((absolute % 10n ** 24n) ? "." + (absolute % 10n ** 24n).toString().padStart(24, "0").replace(/0+$/, "") : "");
}
export function available(v: Ledger): string { return (BigInt(v.credited) - BigInt(v.finalized_spent) - BigInt(v.pending_reserved) - BigInt(v.completed_withdrawals) - BigInt(v.pending_withdrawals)).toString(); }
export function remainingSeconds(g: Grant, now = Date.now()): number { return Math.max(0, Number(BigInt(g.policy.expires_at_ns) / 1_000_000n - BigInt(now)) / 1000); }
export function transfer(g: Grant, grantId: string, scenario: "allow" | "cap" | "recipient" | "replay") {
  return { grant_id: grantId, intent_id: `web-${crypto.randomUUID().replaceAll("-", "")}`, nonce: scenario === "replay" ? "0" : g.next_nonce, asset: "NEAR", recipient: scenario === "recipient" ? g.owner : PAYEE,
    amount: scenario === "cap" ? (BigInt(g.policy.spend_cap) + 1n).toString() : "10000000000000000000000", policy_hash: g.policy.policy_hash };
}
export function assertIdentity(h: { chain: string; network: string; contractId: string; executorId: string; identityEnforced: boolean }) {
  if (h.chain !== "near" || h.network !== "testnet" || h.contractId !== CONTRACT || h.executorId !== EXECUTOR || !h.identityEnforced) throw Error("API không khớp NEAR Testnet đã duyệt.");
}
export type Proposal = { network: string; signerId: string; unsigned: boolean; canonicalPolicy?: string; transaction: { receiverId: string; actions: { type: "FunctionCall"; params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string } }[] } };
/** Treat the server's unsigned proposal as untrusted until every authority field matches. */
export async function validateProposal(p: Proposal, owner: string, method: OwnerMethod, grantId?: string, now = Date.now()) {
  if (!p.unsigned || p.network !== "testnet" || p.signerId !== owner || p.transaction.receiverId !== CONTRACT || p.transaction.actions.length !== 1) throw Error("Đề xuất ký không hợp lệ.");
  const a = p.transaction.actions[0];
  if (a.type !== "FunctionCall" || a.params.methodName !== method || a.params.gas !== "100000000000000") throw Error("Quyền hoặc gas bị thay đổi.");
  if (method === "storage_deposit" || method === "deposit") {
    if (a.params.deposit !== (method === "storage_deposit" ? STORAGE_FUNDING : PRINCIPAL_FUNDING) || !a.params.args || typeof a.params.args !== "object" || Array.isArray(a.params.args) || Object.keys(a.params.args).length !== 0 || p.canonicalPolicy !== undefined) throw Error("Khoản nạp khác đề xuất demo đã xem lại.");
    return;
  }
  if (a.params.deposit !== "0") throw Error("Deposit không được thay đổi.");
  if (method === "revoke_grant") {
    if (a.params.args.grant_id !== grantId || Object.keys(a.params.args).length !== 1) throw Error("Sai grant cần thu hồi.");
    return;
  }
  const args = a.params.args as { grant_id: string; policy: Grant["policy"] }, policy = args.policy;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(args.grant_id) || !policy || policy.executor !== EXECUTOR || policy.spend_cap !== CAP || policy.max_transactions !== 3 || policy.cooldown_ns !== "0" || policy.recipients.length !== 1 || policy.recipients[0] !== PAYEE) throw Error("Policy khác cấu hình demo đã duyệt.");
  const seconds = remainingSeconds({ policy } as Grant, now);
  if (seconds < 30 || seconds > 8 * 3600) throw Error("Hạn grant phải còn từ 30 giây đến 8 giờ.");
  const c = JSON.parse(p.canonicalPolicy ?? "{}");
  const expected = { schema: "redline.near.policy.v1", network: "testnet", contract_id: CONTRACT, owner_id: owner, grant_id: args.grant_id, executor: EXECUTOR, asset: "NEAR", spend_cap: CAP, max_transactions: 3, recipients: [PAYEE], expires_at_ns: policy.expires_at_ns, cooldown_ns: "0" };
  if (JSON.stringify(c) !== JSON.stringify(expected)) throw Error("Canonical policy không khớp.");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p.canonicalPolicy!))), b => b.toString(16).padStart(2, "0")).join("");
  if (digest !== policy.policy_hash || Object.keys(policy).length !== 7 || Object.keys(args).length !== 2) throw Error("Policy hash không khớp.");
}
