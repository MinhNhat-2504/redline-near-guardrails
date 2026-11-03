// Read-only public RPC verification. No session, wallet/executor secret or DB access.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, isAbsolute } from "node:path";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { collectKeyResetInputs, verifyKeyReset, type ResetPlan } from "../src/near/key-reset.js";
import { hashId, transferSchema } from "../src/near/types.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
async function main() {
  if (process.argv[2] === "--help") { console.log("Read-only: verify-near-executor-reset.ts <reset transaction hash>. Reads public RPC/proposals only. Never signs, broadcasts, reads tokens/keys or changes DB."); return; }
  if (process.argv.length !== 3) throw new Error("Provide exactly the reset transaction hash");
  const resetHash = hashId.parse(process.argv[2]);
  const proposal = JSON.parse(await readFile(resolve(root, "docs/NEAR_EXECUTOR_KEY_RESET_UNSIGNED.json"), "utf8"));
  let frozen: { plan: ResetPlan } | undefined;
  try { frozen = JSON.parse(await readFile(resolve(root, "docs/evidence/phase3-executor-key-reset-inputs.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  let plan: ResetPlan;
  if (frozen) plan = frozen.plan; // Never follow a later recovery package's pointer for the old packet.
  else {
  const base = resolve(root, ".tooling/near-api-demo");
  const directory = (await readFile(resolve(base, "latest-package.txt"), "utf8")).trim();
  const child = relative(base, directory); assert(child && !child.startsWith("..") && !isAbsolute(child));
  const args = transferSchema.parse(JSON.parse(await readFile(resolve(directory, "transfer-safe.json"), "utf8")));
  const grant = JSON.parse(await readFile(resolve(directory, "grant.json"), "utf8"));
  assert.equal(grant.grant_id, args.grant_id); assert.equal(grant.policy.policy_hash, args.policy_hash);
  const saved = async (name: string) => JSON.parse((await readFile(resolve(root, "docs/evidence/" + name), "utf8")).replace(/^\uFEFF/, ""));
  const ownerBaseline = await saved("phase3-api-owner-before-transfer.json");
  const payeeBaseline = await saved("phase3-api-payee-before-transfer.json");
  plan = { executor: proposal.signerId, contract: proposal.actions[1].permission.FunctionCall.receiver_id,
    owner: "nhat-redline-owner.testnet", publicKey: proposal.actions[1].publicKey,
    oldHash: proposal.oldTransactionHash, oldKeyNonce: proposal.oldSignedPacketNonce, resetHash,
    args, policy: grant.policy, baselineLedger: JSON.parse(Buffer.from(ownerBaseline.result.result).toString("utf8")), baselinePayee: payeeBaseline.result.amount };
  }
  assert.equal(plan.resetHash, resetHash); assert.equal(plan.oldHash, proposal.oldTransactionHash);
  assert.equal(plan.oldKeyNonce, proposal.oldSignedPacketNonce); assert.equal(plan.publicKey, proposal.actions[1].publicKey);
  assert.equal(plan.executor, proposal.signerId); assert.equal(plan.contract, proposal.actions[1].permission.FunctionCall.receiver_id);
  assert.equal(plan.owner, "nhat-redline-owner.testnet");
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const inputs = await collectKeyResetInputs(rpc, plan);
  const report = verifyKeyReset(plan, inputs);
  // Save only after every assertion passes. Absence of a report never means success.
  const prefix = frozen ? "phase3-executor-key-reset-recheck" : "phase3-executor-key-reset";
  await writeFile(resolve(root, `docs/evidence/${prefix}-inputs.json`), JSON.stringify({ plan, inputs }, null, 2) + "\n");
  await writeFile(resolve(root, `docs/evidence/${prefix}-verification.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log("Keep backend stopped. No journal was changed and no replacement transaction was signed/submitted.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Reset verification failed"); process.exitCode = 1; });
