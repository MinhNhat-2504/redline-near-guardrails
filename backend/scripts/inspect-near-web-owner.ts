// Read-only public Testnet baseline. No wallet/session/configuration loading.
import { writeFile } from "node:fs/promises";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { fundingStatus } from "../src/near/funding.js";
async function main() {
  const path = process.argv[2];
  if (!path || path === "--help") { console.log("Read-only public web-owner baseline: <new-output.json>"); return; }
  const accountId = "nhat-redline-web.testnet", contractId = "nhat-redline-vault.testnet";
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const account = await rpc.account(accountId);
  const balance = await fundingStatus(rpc, contractId, accountId);
  await writeFile(path, JSON.stringify({ status: "PUBLIC_BASELINE_ONLY", capturedAt: new Date().toISOString(), network: "testnet", accountId, contractId, account, balance }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ accountId, balance, scope: "Public snapshot, no funding/signature/approval inferred" }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public baseline failed"); process.exitCode = 1; });
