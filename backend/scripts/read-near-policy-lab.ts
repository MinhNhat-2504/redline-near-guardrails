// Public RPC only: no auth/session/DB/key reads or transaction submission.
import { writeFile } from "node:fs/promises";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { analyzeNearPolicy } from "../src/near/policy-lab.js";
import { grantSchema, recordId, viewSchema } from "../src/near/types.js";
async function main() {
  const [grantId, output] = process.argv.slice(2);
  if (!grantId || grantId === "--help") { console.log("Public read-only Policy Lab: <grant-id> <new-output.json>. Prediction only, never a transaction proof."); return; }
  recordId.parse(grantId); if (!output) throw Error("New evidence path required");
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const contract = "nhat-redline-vault.testnet";
  const g = viewSchema(grantSchema).parse(await rpc.view(contract, "get_grant", { grant_id: grantId })).value;
  const report = await analyzeNearPolicy(rpc, contract, { grantId, amount: "10000000000000000000000", recipient: "nhat-redline-payee.testnet", nonce: g.next_nonce, asset: "NEAR", policyHash: g.policy.policy_hash });
  await writeFile(output, JSON.stringify({ capturedAt: new Date().toISOString(), scope: "PUBLIC_READ_ONLY_PREDICTION_NOT_RECEIPT", report }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ predicted: report.predicted, blockHeight: report.blockHeight, blockHash: report.blockHash }));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Policy Lab read failed"); process.exitCode = 1; });
