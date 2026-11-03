// Public Testnet reads only; no wallet, session, database or broadcast access.
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { decodeBase64Json, observeVaultTransaction } from "../src/near/receipts.js";

async function main() {
  const [output] = process.argv.slice(2);
  if (!output || output === "--help") {
    console.log("Read-only: <new-evidence.json>; verify the four owner-supplied browser rejection hashes. No financial submission.");
    return;
  }
  const vault = "nhat-redline-vault.testnet", agent = "nhat-redline-agent.testnet";
  const owner = "nhat-redline-web.testnet", payee = "nhat-redline-payee.testnet";
  const grantId = "grant-1b031438090c4fa1902eb9ddcbd1f47c";
  const key = "ed25519:9hauPZp4YBAHNMNp8bf4ThyYuSMeVTrKn5twEU2JrCy3";
  const amount = "10000000000000000000000";
  const cases = [
    { hash: "CX71RxEViVW2xrVxQBtELiPNic8NwCMchoxwxhvfymtX", reason: "SPEND_CAP_EXCEEDED", nonce: "1", recipient: payee, amount: "50000000000000000000001" },
    { hash: "GympRgkPjYkNLa6NTDp6eaALgh5hTiHnhNi6T7PYJ5pX", reason: "DESTINATION_NOT_ALLOWED", nonce: "1", recipient: owner, amount },
    { hash: "9LdgMWE3aE7PJ3vHa9veApZ6yFdRstVfwKRPdS9fdV1w", reason: "NONCE_REPLAY", nonce: "0", recipient: payee, amount },
    { hash: "FJ83pdozw6gNZdcDoVrJZLLjKVkBsta6CxoTqt6YbeJP", reason: "REVOKED", nonce: "1", recipient: payee, amount },
  ];
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const grant: any = await rpc.view(vault, "get_grant", { grant_id: grantId });
  if (grant.value?.owner !== owner || grant.value?.active !== false || grant.value?.next_nonce !== "1" || grant.value?.finalized_spent !== amount || grant.value?.pending_reserved !== "0" || grant.value?.pending_transactions !== 0) throw Error("Current grant invariant mismatch");
  const evidence = [];
  const blocks: Record<string, unknown> = {};
  const intentIds = new Set<string>();
  for (const expected of cases) {
    const tx: any = await rpc.transaction(expected.hash, agent);
    const observation = observeVaultTransaction(tx, vault, expected.hash, agent);
    if (!observation.finalized || observation.state !== "REJECTED" || observation.reason !== expected.reason) throw Error(`Unexpected rejection: ${expected.reason}`);
    const call = tx.transaction.actions[0]?.FunctionCall;
    if (tx.transaction.actions.length !== 1 || tx.transaction.public_key !== key || call?.method_name !== "execute_transfer" || call.deposit !== "0" || String(call.gas) !== "80000000000000") throw Error("Scoped call mismatch");
    const request: any = decodeBase64Json(call.args);
    if (request.grant_id !== grantId || request.policy_hash !== grant.value.policy.policy_hash || request.asset !== "NEAR" || request.nonce !== expected.nonce || request.recipient !== expected.recipient || request.amount !== expected.amount || typeof request.intent_id !== "string" || intentIds.has(request.intent_id)) throw Error("Case request mismatch");
    intentIds.add(request.intent_id);
    const intent: any = await rpc.view(vault, "get_intent", { grant_id: grantId, intent_id: request.intent_id });
    if (!isDeepStrictEqual(intent.value, decodeBase64Json(tx.status.SuccessValue))) throw Error("Stored intent differs from final return");
    if (observation.events.some(e => e.event === "intent_pending" || e.event === "intent_completed") || tx.receipts_outcome.some((r: any) => r.outcome.executor_id === request.recipient || "Failure" in r.outcome.status)) throw Error("Unexpected dispatch or failed receipt in rejection");
    for (const receipt of tx.receipts_outcome) if (!blocks[receipt.block_hash]) blocks[receipt.block_hash] = await rpc.blockAtHash(receipt.block_hash);
    evidence.push({ expected, request, observation, intent, transaction: tx });
  }
  const balance: any = await rpc.view(vault, "get_owner_balance", { owner });
  if (balance.value?.credited !== "100000000000000000000000" || balance.value?.finalized_spent !== amount || balance.value?.pending_reserved !== "0" || balance.value?.pending_withdrawals !== "0" || balance.value?.completed_withdrawals !== "0") throw Error("Current ledger invariant mismatch");
  const report = { status: "VERIFIED_FOUR_FINAL_WEB_REJECTIONS", capturedAt: new Date().toISOString(), network: "testnet", evidence, blocks, grant, balance,
    limitations: "Receipt events and stored intents verified. Current grant/ledger are not historical before/after snapshots. Funding/create/revoke owner-action receipts still require separate verification." };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, cases: evidence.map(e => ({ hash: e.expected.hash, reason: e.observation.reason, finalized: e.observation.finalized })), principalAvailable: "0.09 NEAR", limitations: report.limitations }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public rejection proof failed"); process.exitCode = 1; });
