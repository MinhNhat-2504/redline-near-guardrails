// Public FINAL Testnet account read; no credentials, database or transaction submission.
import { writeFile } from "node:fs/promises";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { accountSnapshot } from "../src/near/account.js";
async function main() {
  const [account, output] = process.argv.slice(2);
  if (!account || account === "--help") { console.log("Public FINAL read: <account-id> <new-output.json>. Native amount is not vault principal or spendable balance."); return; }
  if (!output) throw Error("New evidence path required");
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const snapshot = await accountSnapshot(rpc, account);
  await writeFile(output, JSON.stringify({ capturedAt: new Date().toISOString(), scope: "PUBLIC_FINAL_ACCOUNT_ONLY", snapshot }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(snapshot));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public account read failed"); process.exitCode = 1; });
