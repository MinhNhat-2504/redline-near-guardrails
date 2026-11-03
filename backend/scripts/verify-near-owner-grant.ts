// Public proposal files and read-only Testnet RPC; no session, keychain or signing.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { decodeBase64Json, observeVaultTransaction } from "../src/near/receipts.js";
import { grantSchema, ledgerSchema, viewSchema } from "../src/near/types.js";
import { PROOF_AGENT, PROOF_KEY, PROOF_OWNER, PROOF_PAYEE, PROOF_VAULT } from "../src/near/allow-proof.js";
async function main() {
  const [directory, hash, prefix] = process.argv.slice(2);
  if (!directory || directory === "--help") { console.log("Read-only: <public-package-directory> <owner-create-grant-tx-hash> <new-evidence-prefix>"); return; }
  if (!hash || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash) || !prefix) throw Error("Invalid public verification arguments");
  const args = JSON.parse((await readFile(join(directory, "grant.json"), "utf8")).replace(/^\uFEFF/, ""));
  const canonical = (await readFile(join(directory, "policy-canonical.json"), "utf8")).replace(/^\uFEFF/, "");
  assert.equal(createHash("sha256").update(canonical).digest("hex"), args.policy.policy_hash);
  const c = JSON.parse(canonical); assert.equal(c.owner_id, PROOF_OWNER); assert.equal(c.contract_id, PROOF_VAULT); assert.equal(c.network, "testnet"); assert.equal(c.grant_id, args.grant_id);
  for (const field of ["executor", "spend_cap", "max_transactions", "recipients", "expires_at_ns", "cooldown_ns"]) assert.deepEqual(c[field], args.policy[field]);
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const transaction: any = await rpc.transaction(hash, PROOF_OWNER);
  const observation = observeVaultTransaction(transaction, PROOF_VAULT, hash, PROOF_OWNER);
  assert.equal(observation.finalized, true); assert.equal(observation.state, "CONFIRMED");
  assert.equal(transaction.transaction.actions.length, 1);
  const action = transaction.transaction.actions[0].FunctionCall;
  assert.equal(action.method_name, "create_grant"); assert.equal(action.deposit, "0"); assert.deepEqual(decodeBase64Json(action.args), args);
  for (const r of [transaction.transaction_outcome, ...transaction.receipts_outcome]) assert(!("Failure" in r.outcome.status));
  const grant = viewSchema(grantSchema).parse(await rpc.view(PROOF_VAULT, "get_grant", { grant_id: args.grant_id })); const g = grant.value;
  assert.deepEqual(g.policy, args.policy); assert.equal(g.owner, PROOF_OWNER); assert(g.active); assert.equal(g.next_nonce, "0"); assert.equal(g.finalized_spent, "0"); assert.equal(g.pending_reserved, "0"); assert.equal(g.finalized_transactions, 0); assert.equal(g.pending_transactions, 0);
  const owner = viewSchema(ledgerSchema).parse(await rpc.view(PROOF_VAULT, "get_owner_balance", { owner: PROOF_OWNER })); const ledger = owner.value;
  const available = BigInt(ledger.credited) - BigInt(ledger.finalized_spent) - BigInt(ledger.pending_reserved) - BigInt(ledger.completed_withdrawals) - BigInt(ledger.pending_withdrawals);
  assert(available >= 10000000000000000000000n);
  const key: any = await rpc.accessKey(PROOF_AGENT, PROOF_KEY), payee = await rpc.account(PROOF_PAYEE);
  assert.equal(key.permission.FunctionCall.receiver_id, PROOF_VAULT); assert.deepEqual(key.permission.FunctionCall.method_names, ["execute_transfer"]); assert(BigInt(key.permission.FunctionCall.allowance) > 80000000000000000000000n); assert(BigInt(key.permission.FunctionCall.allowance) <= 100000000000000000000000n);
  const block: any = await rpc.finalBlock(); assert(BigInt(g.policy.expires_at_ns) > BigInt(block.header.timestamp_nanosec) + 30000000000n);
  const report = { status: "PASS_FINAL_OWNER_GRANT_PREFLIGHT", grantId: args.grant_id, transactionHash: hash, policyHash: g.policy.policy_hash, expiresAtNs: g.policy.expires_at_ns, availableYocto: available.toString(), keyNonce: key.nonce, scope: "FINAL owner grant and pre-transfer public snapshots. No transfer or API ALLOW proof." };
  await writeFile(prefix + "-inputs.json", JSON.stringify({ network: "testnet", args, canonical, transaction, grant, owner, key, payee, block }, null, 2) + "\n", { flag: "wx" });
  await writeFile(prefix + "-verification.json", JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public preflight failed"); process.exitCode = 1; });
