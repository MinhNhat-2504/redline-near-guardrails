import { z } from "zod";
import { u64, yocto } from "./units.js";

const status = z.union([
  z.object({ SuccessValue: z.string() }).strict(),
  z.object({ SuccessReceiptId: z.string() }).strict(),
  z.object({ Failure: z.unknown() }).strict(),
  z.literal("Unknown"), z.literal("NotStarted"), z.literal("Started"),
]);
const outcome = z.object({
  id: z.string(), outcome: z.object({ executor_id: z.string(), logs: z.array(z.string()), status }),
});
const response = z.object({
  final_execution_status: z.string(),
  transaction: z.object({ hash: z.string(), signer_id: z.string(), receiver_id: z.string(), actions: z.array(z.unknown()) }),
  status,
  receipts_outcome: z.array(outcome).optional(),
});
const reason = z.enum([
  "OK", "REVOKED", "EXPIRED", "NONCE_REPLAY", "ASSET_NOT_ALLOWED", "DESTINATION_NOT_ALLOWED",
  "TX_CAP_EXCEEDED", "SPEND_CAP_EXCEEDED", "COOLDOWN_ACTIVE", "POLICY_HASH_MISMATCH",
  "INVALID_AMOUNT", "INSUFFICIENT_BALANCE", "TRANSFER_FAILED",
]);
const intent = z.object({
  nonce: z.string().refine(v => { try { u64(v); return true; } catch { return false; } }),
  amount: z.string().refine(v => { try { yocto(v); return true; } catch { return false; } }),
  recipient: z.string(), status: z.enum(["PENDING", "SETTLED", "FAILED", "REJECTED"]), reason,
}).strict();
export interface VaultEvent {
  id: string;
  receiptId: string;
  transactionHash: string;
  logIndex: number;
  event: string;
  data: unknown[];
}
export interface VaultObservation {
  transactionHash: string;
  finalized: boolean;
  state: "PENDING" | "SETTLED" | "FAILED" | "REJECTED" | "RUNTIME_FAILED" | "UNKNOWN";
  reason?: z.infer<typeof reason>;
  events: VaultEvent[];
}

export function decodeBase64Json(value: string): unknown {
  if (value.length > 2_000_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("Malformed or oversized base64 JSON");
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(value, "base64")));
}

/** Only FINAL and matching vault-emitted receipt events can establish settlement. */
export function observeVaultTransaction(input: unknown, contract: string, hash: string, signer: string): VaultObservation {
  const tx = response.parse(input);
  if (tx.transaction.hash !== hash || tx.transaction.signer_id !== signer || tx.transaction.receiver_id !== contract) {
    throw new Error("Transaction identity mismatch");
  }
  const base: VaultObservation = { transactionHash: hash, finalized: false, state: "PENDING", events: [] };
  if (tx.final_execution_status !== "FINAL") return base;
  base.finalized = true;
  base.state = "UNKNOWN";
  if (typeof tx.status === "object" && "Failure" in tx.status) return { ...base, state: "RUNTIME_FAILED" };
  if (!tx.receipts_outcome || !tx.receipts_outcome.length) throw new Error("FINAL response has no receipt outcomes");
  const receiptIds = new Set<string>();
  for (const receipt of tx.receipts_outcome) {
    if (receiptIds.has(receipt.id)) throw new Error("Duplicate receipt ID");
    receiptIds.add(receipt.id);
    const o = receipt.outcome;
    if (typeof o.status !== "object") throw new Error("Unresolved receipt in FINAL response");
    if (o.executor_id !== contract || typeof o.status !== "object" || "Failure" in o.status) continue;
    if (!("SuccessValue" in o.status || "SuccessReceiptId" in o.status)) continue;
    o.logs.forEach((log, logIndex) => {
      if (!log.startsWith("EVENT_JSON:")) return;
      const event = z.object({ standard: z.literal("redline"), version: z.literal("1.0.0"), event: z.string(), data: z.array(z.unknown()) })
        .safeParse(JSON.parse(log.slice("EVENT_JSON:".length)));
      if (!event.success) return;
      base.events.push({ id: `${hash}:${receipt.id}:${logIndex}`, receiptId: receipt.id, transactionHash: hash, logIndex, event: event.data.event, data: event.data.data });
    });
  }
  if (typeof tx.status !== "object" || !("SuccessValue" in tx.status) || !tx.status.SuccessValue) return base;
  const terminal = intent.safeParse(decodeBase64Json(tx.status.SuccessValue));
  if (!terminal.success) return base; // e.g. create_grant, revoke, withdrawal; not an agent transfer
  if (tx.transaction.actions.length !== 1) return base;
  const action = z.object({ FunctionCall: z.object({ method_name: z.literal("execute_transfer"), args: z.string(), deposit: z.literal("0") }) }).safeParse(tx.transaction.actions[0]);
  if (!action.success) return base;
  const args = z.object({ grant_id: z.string(), intent_id: z.string(), nonce: z.string(), amount: z.string(), recipient: z.string() })
    .parse(decodeBase64Json(action.data.FunctionCall.args));
  const value = terminal.data;
  if (args.nonce !== value.nonce || args.amount !== value.amount || args.recipient !== value.recipient) throw new Error("Return value does not match transfer arguments");
  const eventName = value.status === "REJECTED" ? "intent_rejected" : value.status === "PENDING" ? "intent_pending" : "intent_completed";
  const matched = base.events.some(e => e.event === eventName && e.data.some(d => {
    const row = z.object({ grant_id: z.string(), intent_id: z.string(), intent }).safeParse(d);
    return row.success && row.data.grant_id === args.grant_id && row.data.intent_id === args.intent_id &&
      Object.entries(value).every(([key, v]) => row.data.intent[key as keyof typeof value] === v);
  }));
  if (!matched) return base;
  if ((value.status === "SETTLED" || value.status === "PENDING") && value.reason !== "OK") throw new Error("Inconsistent intent reason");
  if (value.status === "REJECTED" && (value.reason === "OK" || value.reason === "TRANSFER_FAILED")) throw new Error("Inconsistent rejection reason");
  if (value.status === "FAILED" && value.reason !== "TRANSFER_FAILED") throw new Error("Inconsistent failed-transfer reason");
  if (value.status === "SETTLED" && tx.receipts_outcome.some(r => typeof r.outcome.status === "object" && "Failure" in r.outcome.status)) return base;
  return { ...base, state: value.status, reason: value.reason };
}
