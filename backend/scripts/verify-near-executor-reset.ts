// Read-only public RPC verification. No session, wallet/executor secret or DB access.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, isAbsolute } from "node:path";
import { NearReadOnlyRpc, NearRpcError } from "../src/near/rpc.js";
import { verifyKeyReset, type ResetPlan } from "../src/near/key-reset.js";
import { hashId, transferSchema } from "../src/near/types.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
async function main() {
  if (process.argv[2] === "--help") { console.log("Read-only: verify-near-executor-reset.ts <reset transaction hash>. Reads public RPC/proposals only. Never signs, broadcasts, reads tokens/keys or changes DB."); return; }
  if (process.argv.length !== 3) throw new Error("Provide exactly the reset transaction hash");
  const resetHash = hashId.parse(process.argv[2]);
  const proposal = JSON.parse(await readFile(resolve(root, "docs/NEAR_EXECUTOR_KEY_RESET_UNSIGNED.json"), "utf8"));
  const base = resolve(root, ".tooling/near-api-demo");
  const directory = (await readFile(resolve(base, "latest-package.txt"), "utf8")).trim();
  const child = relative(base, directory); assert(child && !child.startsWith("..") && !isAbsolute(child));
  const args = transferSchema.parse(JSON.parse(await readFile(resolve(directory, "transfer-safe.json"), "utf8")));
  const grant = JSON.parse(await readFile(resolve(directory, "grant.json"), "utf8"));
  assert.equal(grant.grant_id, args.grant_id); assert.equal(grant.policy.policy_hash, args.policy_hash);
  const saved = async (name: string) => JSON.parse((await readFile(resolve(root, "docs/evidence/" + name), "utf8")).replace(/^\uFEFF/, ""));
  const ownerBaseline = await saved("phase3-api-owner-before-transfer.json");
  const payeeBaseline = await saved("phase3-api-payee-before-transfer.json");
  const plan: ResetPlan = { executor: proposal.signerId, contract: proposal.actions[1].permission.FunctionCall.receiver_id,
    owner: "nhat-redline-owner.testnet", publicKey: proposal.actions[1].publicKey,
    oldHash: proposal.oldTransactionHash, oldKeyNonce: proposal.oldSignedPacketNonce, resetHash,
    args, policy: grant.policy, baselineLedger: JSON.parse(Buffer.from(ownerBaseline.result.result).toString("utf8")), baselinePayee: payeeBaseline.result.amount };
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const reset = await rpc.transaction(resetHash, plan.executor) as any;
  assert.equal(reset.final_execution_status, "FINAL", "Reset is not FINAL");
  const blocks = [];
  const hashes = new Set<string>([reset.transaction_outcome.block_hash, ...reset.receipts_outcome.map((r: any) => r.block_hash)]);
  for (const hash of hashes) blocks.push(await rpc.blockAtHash(hash));
  const access = await rpc.accessKey(plan.executor, plan.publicKey);
  const signingAccess = await rpc.accessKey(plan.executor, reset.transaction.public_key);
  let originalUnknown = false;
  try { await rpc.transaction(plan.oldHash, plan.executor, "NONE"); }
  catch (error) {
    if (error instanceof NearRpcError && error.code === "REMOTE_ERROR" && error.remoteName === "UNKNOWN_TRANSACTION") originalUnknown = true;
    else throw new Error("Original transaction lookup unavailable; no invalidation inferred");
  }
  const currentGrant = await rpc.view(plan.contract, "get_grant", { grant_id: args.grant_id });
  const ledger = await rpc.view(plan.contract, "get_owner_balance", { owner: plan.owner });
  const intent = await rpc.view(plan.contract, "get_intent", { grant_id: args.grant_id, intent_id: args.intent_id });
  const payee = await rpc.account(args.recipient);
  const inputs = { reset, blocks, access, signingAccess, grant: currentGrant, ledger, intent, payee, originalUnknown };
  const report = verifyKeyReset(plan, inputs);
  // Save only after every assertion passes. Absence of a report never means success.
  await writeFile(resolve(root, "docs/evidence/phase3-executor-key-reset-inputs.json"), JSON.stringify({ plan, inputs }, null, 2) + "\n");
  await writeFile(resolve(root, "docs/evidence/phase3-executor-key-reset-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log("Keep backend stopped. No journal was changed and no replacement transaction was signed/submitted.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Reset verification failed"); process.exitCode = 1; });
