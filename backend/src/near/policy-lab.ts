import { z } from "zod";
import { accountId, amount, grantSchema, hashId, httpError, ledgerSchema, recordId, uint64, type NearGrant } from "./types.js";
import type { NearReadOnlyRpc } from "./rpc.js";

export const labInput = z.object({ grantId: recordId, amount, recipient: accountId, nonce: uint64,
  asset: z.string().min(1).max(16), policyHash: z.string().regex(/^[a-f0-9]{64}$/), intentId: recordId.optional() }).strict();
type Input = z.infer<typeof labInput>;
type Ledger = z.infer<typeof ledgerSchema>;
export function evaluateNearPolicy(g: NearGrant, b: Ledger, r: Input, now: string, duplicate: boolean) {
  // Order mirrors contracts/near-safety-vault/src/lib.rs::evaluate. No reservations or writes.
  const checks: [string, boolean, string][] = [
    ["REVOKED", g.active, "Grant phải còn hoạt động."],
    ["EXPIRED", BigInt(now) < BigInt(g.policy.expires_at_ns), "Thời gian block phải trước hạn grant."],
    ["NONCE_REPLAY", !duplicate && r.nonce === g.next_nonce, "Nonce phải khớp và intent ID chưa tồn tại."],
    ["ASSET_NOT_ALLOWED", r.asset === "NEAR", "Vault chỉ chuyển native NEAR."],
    ["DESTINATION_NOT_ALLOWED", g.policy.recipients.includes(r.recipient), "Người nhận phải có trong policy."],
    ["TX_CAP_EXCEEDED", g.finalized_transactions + g.pending_transactions < g.policy.max_transactions, "Số lượt tính cả lượt đang chờ callback."],
    ["SPEND_CAP_EXCEEDED", BigInt(g.finalized_spent) + BigInt(g.pending_reserved) + BigInt(r.amount) <= BigInt(g.policy.spend_cap), "Cap tính cả tiền đang giữ chỗ."],
    ["COOLDOWN_ACTIVE", !g.has_reserved || (BigInt(now) > BigInt(g.last_reserved_ns) ? BigInt(now) - BigInt(g.last_reserved_ns) : 0n) >= BigInt(g.policy.cooldown_ns), "Cooldown tính từ lần giữ chỗ gần nhất."],
    ["POLICY_HASH_MISMATCH", r.policyHash === g.policy.policy_hash, "Đề xuất phải dùng đúng hash policy."],
    ["INVALID_AMOUNT", BigInt(r.amount) > 0n, "Số tiền phải lớn hơn 0."],
    ["INSUFFICIENT_BALANCE", BigInt(r.amount) <= BigInt(b.credited) - BigInt(b.finalized_spent) - BigInt(b.pending_reserved) - BigInt(b.completed_withdrawals) - BigInt(b.pending_withdrawals), "Principal trừ tiền đã chi, giữ chỗ và rút; storage tính riêng."],
  ];
  let blocked = false;
  const gates = checks.map(([reason, pass, explanation]) => { const status = blocked ? "NOT_EVALUATED" : pass ? "PASS" : "BLOCK"; if (!pass) blocked = true; return { reason, status, explanation }; });
  return { predicted: gates.find(gate => gate.status === "BLOCK")?.reason ?? "ALLOW", gates };
}

/** Only public RPC reads, all pinned to one already FINAL block. No DB, signer, model or broadcast. */
export async function analyzeNearPolicy(rpc: NearReadOnlyRpc, contractId: string, input: unknown) {
  const r = labInput.parse(input);
  const block = z.object({ header: z.object({ hash: hashId, height: z.number().int().nonnegative().safe(), timestamp_nanosec: uint64 }) }).parse(await rpc.finalBlock()).header;
  async function view<T extends z.ZodType>(method: string, args: Record<string, unknown>, schema: T) {
    const v = z.object({ value: z.unknown(), blockHeight: z.number().int().nonnegative().safe(), blockHash: hashId }).parse(await rpc.view(contractId, method, args, block.hash));
    if (v.blockHash !== block.hash || v.blockHeight !== block.height) throw httpError(503, "Policy Lab snapshot block mismatch");
    return schema.parse(v.value) as z.infer<T>;
  }
  const grant = await view("get_grant", { grant_id: r.grantId }, grantSchema.nullable());
  if (!grant) throw httpError(404, "NEAR grant not found");
  const ledger = await view("get_owner_balance", { owner: grant.owner }, ledgerSchema);
  const duplicate = r.intentId ? (await view("get_intent", { grant_id: r.grantId, intent_id: r.intentId }, z.unknown())) !== null : false;
  return { network: "testnet", contractId, grantId: r.grantId, owner: grant.owner, blockHeight: block.height, blockHash: block.hash,
    timestampNs: block.timestamp_nanosec, candidate: r, grant, ledger, ...evaluateNearPolicy(grant, ledger, r, block.timestamp_nanosec, duplicate),
    notice: "Dự đoán tại snapshot FINAL, không phải receipt hay cam kết chuyển tiền. State có thể đổi trước khi thực thi. Chưa kiểm tra gas, storage executor, quyền khóa hoặc khả năng callback. Copilot dùng quy tắc, chưa gọi LLM." };
}
