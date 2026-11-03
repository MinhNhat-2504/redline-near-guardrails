// Public Testnet reads only. No session, wallet keys, database or broadcast.
import { writeFile } from "node:fs/promises";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { observeFunding, fundingStatus } from "../src/near/funding.js";
import { decodeBase64Json } from "../src/near/receipts.js";

async function main() {
  const [method, hash, output] = process.argv.slice(2);
  if (!method || method === "--help") {
    console.log("Read-only: <storage_deposit|deposit> <public-hash> <new-evidence.json>. Fixed web owner and reviewed amounts."); return;
  }
  if ((method !== "storage_deposit" && method !== "deposit") || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash ?? "") || !output) throw Error("Invalid arguments");
  const owner = "nhat-redline-web.testnet", vault = "nhat-redline-vault.testnet";
  const amount = method === "storage_deposit" ? "50000000000000000000000" : "100000000000000000000000";
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const transaction: any = await rpc.transaction(hash, owner);
  const observation = observeFunding(transaction, vault, owner, { hash, method, amount, minBlockHeight: 0 });
  if (!observation.finalized || observation.state !== "CONFIRMED") throw Error("Funding not FINAL CONFIRMED");
  const returnedLedger: any = decodeBase64Json(transaction.status.SuccessValue);
  if (returnedLedger.credited !== (method === "storage_deposit" ? "0" : amount) || returnedLedger.finalized_spent !== "0" || returnedLedger.pending_reserved !== "0" || returnedLedger.pending_withdrawals !== "0" || returnedLedger.completed_withdrawals !== "0" || BigInt(returnedLedger.storage_available) <= 0n) throw Error("Unexpected initial funding ledger");
  const blocks: Record<string, any> = {};
  for (const receipt of transaction.receipts_outcome) if (!blocks[receipt.block_hash]) blocks[receipt.block_hash] = await rpc.blockAtHash(receipt.block_hash);
  const execution = transaction.receipts_outcome.find((r: any) => r.outcome.executor_id === vault);
  if (!execution || blocks[execution.block_hash].header.hash !== execution.block_hash) throw Error("Missing matching vault execution block");
  const currentFunding = await fundingStatus(rpc, vault, owner);
  const report = { status: "VERIFIED_FINAL_WEB_FUNDING", capturedAt: new Date().toISOString(), network: "testnet", method, hash, amount, owner, contractId: vault, observation, returnedLedger, executionBlockHeight: blocks[execution.block_hash].header.height, transaction, blocks, currentFunding,
    limitations: "Historical funding return and current ledger verified separately. Original in-memory proposal timestamp/durable attempt not independently available; no new funding or full Phase4 PASS inferred." };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, method, hash, executionBlockHeight: report.executionBlockHeight, returnedLedger }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public funding proof failed"); process.exitCode = 1; });
