// Public Testnet reads only. No wallet, session, database or broadcast access.
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { decodeBase64Json, observeVaultTransaction } from "../src/near/receipts.js";

async function main() {
  const [hash, output] = process.argv.slice(2);
  if (!hash || hash === "--help") {
    console.log("Read-only: <public-transaction-hash> <new-evidence.json>. No before/payee-delta proof inferred.");
    return;
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash) || !output) throw Error("Invalid arguments");
  const vault = "nhat-redline-vault.testnet", agent = "nhat-redline-agent.testnet";
  const owner = "nhat-redline-web.testnet", payee = "nhat-redline-payee.testnet";
  const publicKey = "ed25519:9hauPZp4YBAHNMNp8bf4ThyYuSMeVTrKn5twEU2JrCy3";
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const tx: any = await rpc.transaction(hash, agent);
  const observation = observeVaultTransaction(tx, vault, hash, agent);
  if (!observation.finalized || observation.state !== "SETTLED" || observation.reason !== "OK") throw Error("No FINAL SETTLED/OK observation");
  const call = tx.transaction.actions[0]?.FunctionCall;
  if (tx.transaction.public_key !== publicKey || call?.method_name !== "execute_transfer" || call.deposit !== "0" || String(call.gas) !== "80000000000000") throw Error("Scoped transaction identity/gas mismatch");
  const request: any = decodeBase64Json(call.args);
  if (request.grant_id !== "grant-1b031438090c4fa1902eb9ddcbd1f47c" || request.nonce !== "0" || request.asset !== "NEAR" || request.recipient !== payee || request.amount !== "10000000000000000000000") throw Error("Web ALLOW request mismatch");
  const grant: any = await rpc.view(vault, "get_grant", { grant_id: request.grant_id });
  const intent: any = await rpc.view(vault, "get_intent", { grant_id: request.grant_id, intent_id: request.intent_id });
  const returned = decodeBase64Json(tx.status.SuccessValue);
  if (grant.value?.owner !== owner || grant.value?.policy?.executor !== agent || grant.value?.policy?.policy_hash !== request.policy_hash || !isDeepStrictEqual(intent.value, returned)) throw Error("Stored owner/policy/intent mismatch");
  const key: any = await rpc.accessKey(agent, publicKey);
  if (key.permission?.FunctionCall?.receiver_id !== vault || !isDeepStrictEqual(key.permission.FunctionCall.method_names, ["execute_transfer"])) throw Error("Current key permission mismatch");
  const balance = await rpc.view(vault, "get_owner_balance", { owner });
  const blocks: Record<string, unknown> = {};
  for (const receipt of tx.receipts_outcome) if (!blocks[receipt.block_hash]) blocks[receipt.block_hash] = await rpc.blockAtHash(receipt.block_hash);
  const report = { status: "VERIFIED_FINAL_WEB_ALLOW", capturedAt: new Date().toISOString(), network: "testnet", hash, request, observation, transaction: tx, blocks, grant, intent, key, balance,
    limitations: "Current snapshots are not historical before/after balances. No exact payee balance delta or complete browser E2E PASS inferred." };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, hash, intentId: request.intent_id, state: observation.state, receiptCount: tx.receipts_outcome.length, limitations: report.limitations }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public proof failed"); process.exitCode = 1; });
