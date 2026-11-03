// Explicit approved LOCAL journal maintenance; no wallet/session/packet reads or signing.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { collectKeyResetInputs, verifyKeyReset, type ResetPlan } from "../src/near/key-reset.js";
import { invalidateResetPacket } from "../src/near/key-recovery.js";
import { hashId } from "../src/near/types.js";
const root = fileURLToPath(new URL("../../", import.meta.url));
async function main() {
  if (process.argv[2] === "--help") { console.log("Approved local key-reset recovery: <resetHash> [--apply]. Default verifies only. --apply preserves old packet/binding/history, marks INVALIDATED after fresh FINAL proof. No signing, broadcast, wallet/session/packet reads."); return; }
  assert(process.argv.length === 3 || (process.argv.length === 4 && process.argv[3] === "--apply"), "Expected resetHash [--apply]");
  const resetHash = hashId.parse(process.argv[2]);
  const saved = JSON.parse(await readFile(resolve(root, "docs/evidence/phase3-executor-key-reset-inputs.json"), "utf8"));
  const proposal = JSON.parse(await readFile(resolve(root, "docs/NEAR_EXECUTOR_KEY_RESET_UNSIGNED.json"), "utf8"));
  const plan: ResetPlan = saved.plan;
  assert.equal(plan.resetHash, resetHash); assert.equal(plan.oldHash, proposal.oldTransactionHash);
  assert.equal(plan.executor, proposal.signerId); assert.equal(plan.publicKey, proposal.actions[1].publicKey);
  assert.equal(plan.contract, proposal.actions[1].permission.FunctionCall.receiver_id); assert.equal(plan.oldKeyNonce, proposal.oldSignedPacketNonce);
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  if (process.argv[3] !== "--apply") {
    console.log(JSON.stringify(verifyKeyReset(plan, await collectKeyResetInputs(rpc, plan)), null, 2));
    console.log("VERIFY ONLY. No DB opened, no journal changed, no packet signed/submitted."); return;
  }
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.pathname, "/redline_near_local"); assert.equal(target.username, "redline_local");
  const guard = resolve(root, "backend/scripts/near-maintenance-guard.ps1").replace(/'/g, "''");
  const assertMaintenance = () => { execFileSync("powershell.exe", ["-NoProfile", "-Command", `. '${guard}'; Assert-NearBackendStopped`], { stdio: "pipe", timeout: 15_000 }); };
  assertMaintenance();
  const db = new PrismaClient();
  try {
    const disposition = await invalidateResetPacket(db, rpc, plan, assertMaintenance);
    const report = { status: "INVALIDATED_BY_FINAL_KEY_RESET", originalTransactionHash: plan.oldHash, resetTransactionHash: plan.resetHash,
      originalGrantId: plan.args.grant_id, originalIntentId: plan.args.intent_id, disposition,
      originalPacketAndBindingPreserved: true, financialAccountingChanged: false, replacementSigned: false };
    await writeFile(resolve(root, "docs/evidence/phase3-executor-journal-recovery.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Recovery stopped; no replacement signed. Check public proof, stopped backend and local DB configuration. Do not submit or edit journal manually."); process.exitCode = 1; });
