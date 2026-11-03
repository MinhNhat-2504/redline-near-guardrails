// USER-RUN ONLY. --submit authorizes exactly one 0.01 native Testnet NEAR intent.
// Does not load executor/wallet keys. A retry always uses the persisted request.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { grantSchema, transferSchema } from "../src/near/types.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const OWNER = "nhat-redline-owner.testnet", AGENT = "nhat-redline-agent.testnet";
const VAULT = "nhat-redline-vault.testnet", PAYEE = "nhat-redline-payee.testnet";
const AMOUNT = "10000000000000000000000";

async function main() {
  const mode = process.argv[2];
  if (mode === "--help") {
    console.log("USER-RUN: default prepares one stable 0.01 NEAR API request; --submit sends/retries that exact request. Keep package and IDs on timeout. No wallet/executor key read.");
    return;
  }
  if (mode !== undefined && mode !== "--submit") throw new Error("Use no argument, --submit or --help");
  const base = resolve(root, ".tooling/near-api-demo");
  const directory = (await readFile(resolve(base, "latest-package.txt"), "utf8")).trim();
  const child = relative(base, directory);
  assert(child && !child.startsWith("..") && !isAbsolute(child), "Unexpected package pointer");
  const reviewed = JSON.parse(await readFile(resolve(directory, "grant.json"), "utf8"));
  const requestFile = resolve(directory, "transfer-safe.json");
  let args;
  try { args = transferSchema.parse(JSON.parse(await readFile(requestFile, "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (!args) {
    // Public reads only during preparation. Never silently replace an existing request.
    const response = await fetch("http://127.0.0.1:8787/near/grants/" + reviewed.grant_id, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`Grant read HTTP ${response.status}; no request submitted`);
    const grant = grantSchema.parse((await response.json()).value);
    assert.equal(grant.owner, OWNER); assert.equal(grant.policy.executor, AGENT);
    assert.deepEqual(grant.policy, reviewed.policy);
    assert.equal(grant.policy.spend_cap, "50000000000000000000000");
    assert.deepEqual(grant.policy.recipients, [PAYEE]);
    assert.equal(grant.active, true); assert.equal(grant.next_nonce, "0");
    assert.equal(grant.pending_transactions, 0); assert.equal(grant.finalized_transactions, 0);
    assert(BigInt(grant.policy.expires_at_ns) > BigInt(Date.now()) * 1000000n, "Grant expired; do not replace it automatically");
    args = transferSchema.parse({ grant_id: reviewed.grant_id, intent_id: "api-safe-" + randomUUID().replace(/-/g, ""), nonce: "0", asset: "NEAR", recipient: PAYEE, amount: AMOUNT, policy_hash: grant.policy.policy_hash });
    // Exclusive creation prevents concurrent preparation from overwriting a request.
    await writeFile(requestFile, JSON.stringify(args, null, 2) + "\n", { flag: "wx" });
  }
  assert.equal(args.grant_id, reviewed.grant_id); assert.equal(args.policy_hash, reviewed.policy.policy_hash);
  assert.equal(args.nonce, "0"); assert.equal(args.amount, AMOUNT); assert.equal(args.recipient, PAYEE);
  console.log(JSON.stringify({ contract: VAULT, executor: AGENT, amountNear: "0.01", request: args }, null, 2));
  if (mode !== "--submit") { console.log("PREPARED ONLY. Review above, then run with --submit. No transaction submitted."); return; }
  let session;
  try { session = JSON.parse(await readFile(resolve(root, ".tooling/near-local/session.json"), "utf8")); }
  catch { throw new Error("Local session unavailable; run near-login-cli.ts. Do not share the session file."); }
  assert.equal(session.accountId, OWNER);
  if (!(Date.parse(session.expiresAt) > Date.now())) throw new Error("Owner session expired; run near-login-cli.ts, then retry this same request");
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:8787/near/grants/" + args.grant_id + "/intents", {
      method: "POST", headers: { authorization: "Bearer " + session.token, "content-type": "application/json" },
      body: JSON.stringify(args), signal: AbortSignal.timeout(120_000), redirect: "error",
    });
  } catch { throw new Error("API outcome UNKNOWN. Keep this request/ID; retry only the same --submit command. Do not create a replacement intent or fund again."); }
  if (!response.ok) throw new Error(`API HTTP ${response.status}. Keep request unchanged; 401 requires fresh login. No settlement inferred.`);
  const observation = await response.json();
  // Persist only selected public fields, never raw headers, tokens or signed packets.
  const report = { grantId: args.grant_id, intentId: args.intent_id, amount: args.amount, recipient: args.recipient,
    transactionHash: observation.transactionHash, finalized: observation.finalized, state: observation.state,
    reason: observation.reason, phase: observation.phase, needsReconciliation: observation.needsReconciliation };
  await writeFile(resolve(root, "docs/evidence/phase3-api-safe-response.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log("API observation only; independent FINAL receipt/key/ledger verification still required. Retry uses the same intent ID.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "API demo unavailable; retain request"); process.exitCode = 1; });
