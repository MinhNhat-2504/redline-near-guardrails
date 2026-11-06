import { near } from "./model";
import type { JournalRow } from "./pending";

const labels: Record<string, string> = { deposit: "Nạp tiền vào quỹ", storage_deposit: "Nạp phí lưu trữ", create_grant: "Cấp quyền cho agent", revoke_grant: "Thu hồi quyền", withdraw: "Rút tiền về ví" };
const object = (v: unknown): Record<string, unknown> | undefined => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 128 ? v : undefined;
function readObservation(value: unknown): Record<string, unknown> | undefined {
  // Prisma history endpoints return the immutable observation JSON as a string.
  // Keep accepting objects for in-memory responses; malformed data stays unknown.
  if (typeof value !== "string") return object(value);
  if (value.length > 2_000_000) return;
  try { return object(JSON.parse(value)); } catch { return; }
}
function amount(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^(0|[1-9][0-9]*)$/.test(v) || v.length > 39 || BigInt(v) >= (1n << 128n)) return;
  return near(v);
}

export function historyDetail(row: JournalRow) {
  const fallback = { label: row.intentId ? "Đề xuất chuyển tiền" : "Thao tác chủ ví", amount: undefined as string | undefined, recipient: undefined as string | undefined, id: row.intentId ?? undefined, missing: true };
  const observation = readObservation(row.observation);
  if (!observation || observation.transactionHash !== row.hash || observation.finalized !== true || observation.state !== row.state) return fallback;
  // Classify only stored matched vault events; never rewrite immutable FINAL observations.
  let detail: Record<string, unknown> | undefined;
  if (Array.isArray(observation.events)) {
    const candidates: Record<string, unknown>[] = [];
    for (const raw of observation.events) {
      const e = object(raw);
      if (e?.transactionHash !== row.hash || !Array.isArray(e.data)) continue;
      for (const value of e.data) {
        const d = object(value); if (!d) continue;
        if (e.event === "withdrawal_completed" && ["SETTLED", "FAILED"].includes(row.state) && d.owner === row.signerId && object(d.withdrawal)?.status === row.state)
          candidates.push({ method: "withdraw", amount: object(d.withdrawal)?.amount, recipient: d.owner, withdrawalId: d.withdrawal_id });
        if (e.event === "deposit" && row.state === "CONFIRMED" && d.owner === row.signerId) candidates.push({ method: "deposit", amount: d.amount });
        if (e.event === "grant_created" && row.state === "CONFIRMED" && object(d.grant)?.owner === row.signerId) candidates.push({ method: "create_grant", grantId: d.grant_id });
        if (e.event === "grant_revoked" && row.state === "CONFIRMED") candidates.push({ method: "revoke_grant", grantId: d.grant_id });
        const intent = object(d.intent);
        if (row.intentId && d.intent_id === row.intentId && d.grant_id === row.grantId && intent?.status === row.state && ["intent_completed", "intent_rejected", "intent_pending"].includes(String(e.event)))
          candidates.push({ method: "execute_transfer", amount: intent.amount, recipient: intent.recipient });
      }
    }
    if (candidates.length === 1) detail = candidates[0];
  }
  if (!detail || typeof detail.method !== "string" || (!Object.hasOwn(labels, detail.method) && detail.method !== "execute_transfer")) return fallback;
  const isTransfer = detail.method === "execute_transfer";
  if (isTransfer ? !row.intentId : !["CONFIRMED", "SETTLED", "FAILED"].includes(row.state)) return fallback;
  return { label: isTransfer ? "Đề xuất chuyển tiền" : labels[detail.method], amount: amount(detail.amount), recipient: text(detail.recipient), id: text(detail.withdrawalId) ?? text(detail.grantId) ?? fallback.id, missing: false };
}

export function HistoryDescription({ row }: { row: JournalRow }) {
  const detail = historyDetail(row);
  return <div className="nw-history-description"><strong>{detail.label}</strong>
    {detail.amount !== undefined && <span>{detail.amount} NEAR{row.state === "REJECTED" || row.state === "FAILED" ? " · số tiền yêu cầu" : ""}</span>}
    {detail.recipient && <span>{row.state === "SETTLED" ? "Nhận tại ví" : "Ví nhận dự kiến"}: <code>{detail.recipient}</code></span>}
    {detail.id && <code>{detail.id}</code>}
    {detail.missing && <small>Bản ghi chưa đủ chi tiết thao tác; xem receipt để kiểm tra.</small>}
  </div>;
}
