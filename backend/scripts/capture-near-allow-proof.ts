// PUBLIC RPC ONLY. No configuration loader, keychain, session, database or broadcast access.
import { readFile, writeFile } from "node:fs/promises";
import { NearReadOnlyRpc, parseRpcJson } from "../src/near/rpc.js";
import { transferSchema } from "../src/near/types.js";
import { PROOF_AGENT, PROOF_KEY, PROOF_OWNER, PROOF_PAYEE, PROOF_VAULT, verifyAllowProof } from "../src/near/allow-proof.js";
async function main() {
  const [mode, requestFile, outputFile, hashOrAfter] = process.argv.slice(2);
  if (mode === "--help" || !mode) { console.log("PUBLIC RPC only. before <public-request.json> <new-output.json>; after <public-request.json> <new-output.json> <txHash>; verify <before.json> <after.json>. No keys, sessions or transactions submitted."); return; }
  if (!requestFile || !outputFile || !["before", "after", "verify"].includes(mode)) throw Error("Invalid arguments; see --help");
  const read = async (path: string) => parseRpcJson((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  if (mode === "verify") { console.log(JSON.stringify(verifyAllowProof(await read(requestFile), await read(outputFile)), null, 2)); return; }
  if (mode === "after" && (!hashOrAfter || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hashOrAfter))) throw Error("Public transaction hash required");
  const request = transferSchema.parse(await read(requestFile));
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const transaction: any = mode === "after" ? await rpc.transaction(hashOrAfter!, PROOF_AGENT) : undefined;
  const blocks: Record<string, unknown> = {};
  if (transaction) for (const r of transaction.receipts_outcome ?? []) if (!blocks[r.block_hash]) blocks[r.block_hash] = await rpc.blockAtHash(r.block_hash);
  const grant = await rpc.view(PROOF_VAULT, "get_grant", { grant_id: request.grant_id });
  const intent = await rpc.view(PROOF_VAULT, "get_intent", { grant_id: request.grant_id, intent_id: request.intent_id });
  const owner = await rpc.view(PROOF_VAULT, "get_owner_balance", { owner: PROOF_OWNER });
  const key = await rpc.accessKey(PROOF_AGENT, PROOF_KEY), payee = await rpc.account(PROOF_PAYEE);
  await writeFile(outputFile, JSON.stringify({ capturedAt: new Date().toISOString(), network: "testnet", request, transaction, blocks, grant, intent, owner, key, payee }, null, 2) + "\n", { flag: "wx" });
  console.log(`Captured PUBLIC ${mode} data. ${outputFile}. Not a PASS until verify succeeds.`);
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public proof capture failed"); process.exitCode = 1; });
