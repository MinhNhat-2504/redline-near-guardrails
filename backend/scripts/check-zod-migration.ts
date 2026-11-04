// Offline migration corpus: no credentials, database, network or financial calls.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { amount, uint64, transferSchema, policySchema, grantSchema, ledgerSchema, viewSchema } from "../src/near/types.js";
import { PositiveU64StringSchema, SolanaAddressSchema } from "../src/validation.js";
import { SimulationInput } from "../src/policy/simulation.js";

export function migrationCorpus() {
  const max64 = ((1n << 64n) - 1n).toString(), max128 = ((1n << 128n) - 1n).toString();
  const policy = { executor: "executor.testnet", policy_hash: "a".repeat(64), spend_cap: "100", max_transactions: 3, recipients: ["payee.testnet"], expires_at_ns: max64, cooldown_ns: "0" };
  const transfer = { grant_id: "grant", intent_id: "intent", nonce: max64, asset: "NEAR", recipient: "payee.testnet", amount: "1", policy_hash: policy.policy_hash };
  const grant = { owner: "owner.testnet", policy, active: true, finalized_spent: "1", pending_reserved: "2", finalized_transactions: 1, pending_transactions: 1, next_nonce: "1", has_reserved: true, last_reserved_ns: "0" };
  const ledger = { credited: "10", finalized_spent: "1", pending_reserved: "2", completed_withdrawals: "3", pending_withdrawals: "1", storage_available: "1" };
  const corpus: { name: string; schema: z.ZodType; input: unknown }[] = [];
  const add = (name: string, schema: z.ZodType, input: unknown) => corpus.push({ name, schema, input });
  for (const [name, schema, max] of [["yocto", amount, max128], ["nonce", uint64, max64], ["legacy-u64", PositiveU64StringSchema, max64]] as const) {
    for (const value of ["0", "1", max, (BigInt(max) + 1n).toString(), "01", "-1", "1.1", "1e3", " 1", "NaN", 1, null]) add(`${name}:${JSON.stringify(value)}`, schema, value);
  }
  add("transfer:valid", transferSchema, transfer);
  for (const patch of [{ amount: "0" }, { asset: "USDC" }, { nonce: "01" }, { amount: "bad" }, { injected: true }]) add(`transfer:${JSON.stringify(patch)}`, transferSchema, { ...transfer, ...patch });
  add("policy:valid", policySchema, policy);
  add("policy:unknown-key", policySchema, { ...policy, owner: "other.testnet" });
  add("policy:too-many-recipients", policySchema, { ...policy, recipients: Array(5).fill("payee.testnet") });
  add("grant:valid", grantSchema, grant);
  add("grant:overspend", grantSchema, { ...grant, pending_reserved: "100" });
  add("grant:overslots", grantSchema, { ...grant, pending_transactions: 3 });
  add("grant:bad-decimal", grantSchema, { ...grant, finalized_spent: "bad" });
  add("ledger:valid", ledgerSchema, ledger);
  add("ledger:overspend", ledgerSchema, { ...ledger, pending_reserved: "100" });
  add("ledger:bad-decimal", ledgerSchema, { ...ledger, credited: "bad" });
  add("view:valid", viewSchema(ledgerSchema), { value: ledger, blockHeight: 42, blockHash: "B".repeat(44) });
  add("view:unsafe-height", viewSchema(ledgerSchema), { value: ledger, blockHeight: Number.MAX_SAFE_INTEGER + 1, blockHash: "B".repeat(44) });
  add("legacy:valid-address", SolanaAddressSchema, "Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4");
  add("legacy:invalid-address", SolanaAddressSchema, "invalid");
  add("legacy:simulation-defaults", SimulationInput, { policy: { spendCapUnits: "1000", maxTransactions: 3, cooldownSeconds: 0, durationSeconds: 100 }, proposal: { amountUnits: "10", attempts: 2, intervalSeconds: 0 } });
  return corpus;
}

async function main() {
  const [mode, path, other] = process.argv.slice(2);
  if (mode === "--help" || !mode) { console.log("Offline: capture <new-report.json>; compare <before.json> <after.json>. Acceptance/results compared; validator error formatting may change."); return; }
  if (!path) throw Error("Report path required");
  if (mode === "compare") {
    if (!other) throw Error("Two report paths required");
    const before = JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
    const after = JSON.parse((await readFile(other, "utf8")).replace(/^\uFEFF/, ""));
    const decisions = (r: any) => r.cases.map(({ name, accepted, value }: any) => ({ name, accepted, ...(accepted ? { value } : {}) }));
    if (!isDeepStrictEqual(decisions(before), decisions(after))) throw Error("Migration acceptance/output regression");
    console.log(JSON.stringify({ status: "PASS", before: before.version, after: after.version, cases: after.cases.length, scope: "Offline acceptance/success-output compatibility, not all error formatting" })); return;
  }
  if (mode !== "capture") throw Error("Unknown mode");
  const cases = migrationCorpus().map(({ name, schema, input }) => {
    try { const r = schema.safeParse(input); return r.success ? { name, accepted: true, value: r.data } : { name, accepted: false, threw: false }; }
    catch { return { name, accepted: false, threw: true }; }
  });
  const version = createRequire(import.meta.url)("zod/package.json").version;
  await writeFile(path, JSON.stringify({ version, scope: "Offline synthetic input corpus; errors normalized, no chain evidence", cases }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ version, cases: cases.length, exceptions: cases.filter(c => c.threw).map(c => c.name) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e instanceof Error ? e.message : "Migration check failed"); process.exitCode = 1; });
