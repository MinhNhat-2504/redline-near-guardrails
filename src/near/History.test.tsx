import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryDescription, HistoryTable, historyDetail } from "./History";
import type { JournalRow } from "./pending";
const load = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/${name}.json`, import.meta.url), "utf8"));
const withdrawal = load("phase4-web-withdrawal-final");
const row = (): JournalRow => ({ hash: withdrawal.hash, signerId: withdrawal.owner, state: "SETTLED", observation: structuredClone(withdrawal.observation) });
describe("NEAR history descriptions", () => {
  it("keeps accessible table roles and labelled card fields for mobile history", () => {
    const onReconcile = () => { throw Error("Must not reconcile while rendering"); };
    const html = renderToStaticMarkup(<HistoryTable rows={[row()]} busy onReconcile={onReconcile} />);
    expect(html).toContain('role="table"'); expect(html).toContain('scope="col"'); expect(html).toContain('role="cell"');
    expect(html).toContain('data-label="Receipt"'); expect(html).toContain('data-label="Trạng thái"');
    expect(html).toContain(withdrawal.owner); expect(html).toContain(withdrawal.hash); expect(html).toContain('disabled=""');
  });
  it.each([
    { ...withdrawal, label: "Rút tiền về ví" },
    ...load("phase4-web-owner-actions-verification").evidence.map((r: any) => ({ ...r, label: r.method === "create_grant" ? "Cấp quyền cho agent" : "Thu hồi quyền" })),
    { ...load("phase4-web-principal-verification"), label: "Nạp tiền vào quỹ" },
  ] as { hash: string; observation: unknown; label: string }[])("reads immutable JSON-string observation from API for $label", fixture => {
    const wireRow: JournalRow = JSON.parse(JSON.stringify({ hash: fixture.hash, signerId: withdrawal.owner, state: (fixture.observation as any).state, observation: JSON.stringify(fixture.observation) }));
    expect(historyDetail(wireRow)).toMatchObject({ label: fixture.label, missing: false });
    expect(renderToStaticMarkup(<HistoryDescription row={wireRow} />)).toContain(fixture.label);
    if (fixture.hash === withdrawal.hash) expect(historyDetail(wireRow)).toMatchObject({ amount: "0.01", recipient: withdrawal.owner, id: withdrawal.withdrawalId });
  });
  it.each(["{", "null", "[]", JSON.stringify(JSON.stringify(withdrawal.observation)), "x".repeat(2_000_001)])("does not classify malformed or nested serialized observations %#", serialized => {
    expect(historyDetail({ ...row(), observation: serialized }).missing).toBe(true);
  });
  it("preserves hash binding after decoding a serialized observation", () => {
    const r = row(); (r.observation as any).transactionHash = "different"; r.observation = JSON.stringify(r.observation);
    expect(historyDetail(r).missing).toBe(true);
  });
  it("identifies archived withdrawal callback and exact NEAR amount for old rows", () => {
    expect(historyDetail(row())).toMatchObject({ label: "Rút tiền về ví", amount: "0.01", recipient: withdrawal.owner, id: withdrawal.withdrawalId, missing: false });
  });
  it.each(load("phase4-web-owner-actions-verification").evidence as { hash: string; method: string; observation: unknown }[])("identifies archived $method", r => {
    expect(historyDetail({ hash: r.hash, signerId: withdrawal.owner, state: "CONFIRMED", observation: r.observation }).label).toBe(r.method === "create_grant" ? "Cấp quyền cho agent" : "Thu hồi quyền");
  });
  it("identifies archived principal deposit", () => {
    const r = load("phase4-web-principal-verification");
    expect(historyDetail({ hash: r.hash, signerId: r.owner, state: "CONFIRMED", observation: r.observation })).toMatchObject({ label: "Nạp tiền vào quỹ", amount: "0.1" });
  });
  it("does not guess storage from a historical state without metadata", () => {
    const r = load("phase4-web-storage-verification");
    expect(historyDetail({ hash: r.hash, state: "CONFIRMED", observation: r.observation })).toMatchObject({ label: "Thao tác chủ ví", missing: true });
  });
  it.each(["hash", "finality", "state", "missing"])("keeps %s mismatch unclassified", kind => {
    const r = row(), o = r.observation as any;
    if (kind === "hash") o.transactionHash = "other";
    if (kind === "finality") o.finalized = false;
    if (kind === "state") o.state = "PENDING";
    if (kind === "missing") r.observation = undefined;
    expect(historyDetail(r).missing).toBe(true);
  });
  it.each(["-1", "1e24", "01", (1n << 128n).toString(), "9".repeat(1000)])("omits malformed/overflow amount %s", value => {
    const r = row(); (r.observation as any).events.find((e: any) => e.event === "withdrawal_completed").data[0].withdrawal.amount = value;
    expect(historyDetail(r).amount).toBeUndefined();
  });
  it("preserves full u128 precision without Number rounding", () => {
    const r = row(); (r.observation as any).events.find((e: any) => e.event === "withdrawal_completed").data[0].withdrawal.amount = "340282366920938463463374607431768211455";
    expect(historyDetail(r).amount).toBe("340282366920938.463463374607431768211455");
  });
  it("escapes receipt identifiers as plain text", () => {
    const r = row(); (r.observation as any).events.find((e: any) => e.event === "withdrawal_completed").data[0].withdrawal_id = "<script>alert(1)</script>";
    expect(renderToStaticMarkup(<HistoryDescription row={r} />)).not.toContain("<script>");
  });
  it("shows intent amounts as requested when rejected", () => {
    const r: JournalRow = { hash: "h", intentId: "i", grantId: "g", state: "REJECTED", observation: { transactionHash: "h", finalized: true, state: "REJECTED", events: [{ transactionHash: "h", event: "intent_rejected", data: [{ intent_id: "i", grant_id: "g", intent: { status: "REJECTED", amount: "10000000000000000000000", recipient: "payee.testnet" } }] }] } };
    expect(renderToStaticMarkup(<HistoryDescription row={r} />)).toContain("số tiền yêu cầu");
  });
  it("does not guess from unrecognized events or forged display metadata", () => {
    const r = row(); (r.observation as any).events = []; (r.observation as any).action = { method: "withdraw", amount: "1" };
    expect(historyDetail(r).missing).toBe(true);
  });
  it("does not choose between ambiguous matching events", () => {
    const r = row(); const events = (r.observation as any).events; events.push(structuredClone(events.find((e: any) => e.event === "withdrawal_completed")));
    expect(historyDetail(r).missing).toBe(true);
  });
});
