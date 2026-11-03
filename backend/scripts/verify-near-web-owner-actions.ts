// Public Testnet reads only. No credentials, session, database or broadcast access.
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { decodeBase64Json, observeVaultTransaction } from "../src/near/receipts.js";

async function main() {
  const [output] = process.argv.slice(2);
  if (!output || output === "--help") {
    console.log("Read-only: <new-evidence.json>; verify both supplied browser owner-action hashes."); return;
  }
  const vault = "nhat-redline-vault.testnet", owner = "nhat-redline-web.testnet";
  const executor = "nhat-redline-agent.testnet", payee = "nhat-redline-payee.testnet";
  const grantId = "grant-1b031438090c4fa1902eb9ddcbd1f47c";
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const grant: any = await rpc.view(vault, "get_grant", { grant_id: grantId });
  if (grant.value?.owner !== owner || grant.value?.active !== false) throw Error("Current revoked grant owner mismatch");
  const evidence = [], blocks: Record<string, any> = {};
  for (const hash of ["7UKKxLJyiFJLiBLr92CRbe8gP21czuv5ru8Du9bWXLM3", "2XojCUvx1QLkA1tsPKS4AM8tacjQjp3Ubv6ZJLFcfJVd"]) {
    const tx: any = await rpc.transaction(hash, owner);
    const observation = observeVaultTransaction(tx, vault, hash, owner);
    if (!observation.finalized || observation.state !== "CONFIRMED") throw Error("Owner action not FINAL CONFIRMED");
    const call = tx.transaction.actions[0]?.FunctionCall;
    if (tx.transaction.actions.length !== 1 || call?.deposit !== "0" || String(call.gas) !== "100000000000000" || !["create_grant", "revoke_grant"].includes(call.method_name)) throw Error("Owner method/deposit/gas mismatch");
    const args: any = decodeBase64Json(call.args);
    if (args.grant_id !== grantId) throw Error("Unexpected grant ID");
    let canonicalPolicy: string | undefined;
    if (call.method_name === "create_grant") {
      const p = args.policy;
      if (Object.keys(args).length !== 2 || !isDeepStrictEqual(p, grant.value.policy) || p.executor !== executor || p.spend_cap !== "50000000000000000000000" || p.max_transactions !== 3 || p.cooldown_ns !== "0" || !isDeepStrictEqual(p.recipients, [payee])) throw Error("Create policy mismatch");
      canonicalPolicy = JSON.stringify({ schema: "redline.near.policy.v1", network: "testnet", contract_id: vault, owner_id: owner, grant_id: grantId, executor, asset: "NEAR", spend_cap: p.spend_cap, max_transactions: 3, recipients: [payee], expires_at_ns: p.expires_at_ns, cooldown_ns: "0" });
      if (createHash("sha256").update(canonicalPolicy).digest("hex") !== p.policy_hash) throw Error("Canonical policy hash mismatch");
    } else if (Object.keys(args).length !== 1) throw Error("Extra revoke arguments");
    for (const r of tx.receipts_outcome) if (!blocks[r.block_hash]) blocks[r.block_hash] = await rpc.blockAtHash(r.block_hash);
    const eventName = call.method_name === "create_grant" ? "grant_created" : "grant_revoked";
    const event = observation.events.find(e => e.event === eventName);
    const receipt = tx.receipts_outcome.find((r: any) => r.id === event?.receiptId);
    if (!event || !receipt) throw Error("Missing exact owner event receipt");
    const executionBlock = blocks[receipt.block_hash].header;
    if (call.method_name === "create_grant") {
      const remaining = BigInt(args.policy.expires_at_ns) - BigInt(executionBlock.timestamp_nanosec);
      if (remaining <= 0n || remaining > 8n * 3600n * 1000000000n) throw Error("Grant expiry outside approved maximum8h at execution");
    }
    evidence.push({ hash, method: call.method_name, args, canonicalPolicy, executionBlockHeight: executionBlock.height, observation, transaction: tx });
  }
  const created = evidence.find(e => e.method === "create_grant"), revoked = evidence.find(e => e.method === "revoke_grant");
  if (!created || !revoked || created.executionBlockHeight >= revoked.executionBlockHeight) throw Error("Create/revoke order mismatch");
  const report = { status: "VERIFIED_FINAL_WEB_CREATE_AND_REVOKE", capturedAt: new Date().toISOString(), network: "testnet", evidence, blocks, grant,
    limitations: "Owner funding receipts not included; no full Phase4 PASS inferred." };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, actions: evidence.map(e => ({ hash: e.hash, method: e.method, finalized: e.observation.finalized, height: e.executionBlockHeight })), limitations: report.limitations }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public owner action proof failed"); process.exitCode = 1; });
