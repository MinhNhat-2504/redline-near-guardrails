import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { collectKeyResetInputs, verifyKeyReset, type ResetPlan } from "./key-reset.js";
import type { NearReadOnlyRpc } from "./rpc.js";
import { transferSchema } from "./types.js";

/** Explicit approved maintenance only. Never loads/signs/rebinds a packet or changes accounting. */
export async function invalidateResetPacket(db: PrismaClient, rpc: NearReadOnlyRpc, plan: ResetPlan, assertMaintenance: () => void) {
  const scope = `testnet:${plan.contract}`;
  return db.$transaction(async tx => {
    assertMaintenance();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ":executor:" + plan.executor}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ":tx:" + plan.oldHash}, 0))`;
    // Deliberately excludes signedBase64: maintenance never needs to read a redeemable packet.
    const row = await tx.nearTransaction.findUniqueOrThrow({ where: { scope_hash: { scope, hash: plan.oldHash } },
      select: { hash: true, state: true, signerId: true, keyPublic: true, keyNonce: true, argsJson: true, ownerId: true, grantId: true, intentId: true, observation: true } });
    assert.equal(row.signerId, plan.executor); assert.equal(row.keyPublic, plan.publicKey);
    assert.equal(row.keyNonce?.toFixed(0), plan.oldKeyNonce); assert.equal(row.ownerId, plan.owner);
    assert.equal(row.grantId, plan.args.grant_id); assert.equal(row.intentId, plan.args.intent_id);
    assert.deepEqual(transferSchema.parse(JSON.parse(row.argsJson!)), plan.args, "Journal args differ from reset plan");
    const request = await tx.nearIntentRequest.findUniqueOrThrow({ where: { scope_grantId_intentId: { scope, grantId: plan.args.grant_id, intentId: plan.args.intent_id } } });
    assert.equal(request.txHash, plan.oldHash); assert.equal(request.ownerId, plan.owner);
    assert.equal(request.argsJson, row.argsJson, "Intent binding changed");
    if (row.state === "INVALIDATED") {
      const existing = JSON.parse(row.observation!);
      assert.equal(existing.keyResetProof?.resetTransactionHash, plan.resetHash, "Conflicting reset disposition");
      return existing; // Explicitly idempotent; no replacement signing or binding update.
    }
    assert(["PREPARED", "SUBMISSION_UNKNOWN", "SUBMITTED"].includes(row.state), "Only unresolved prepared executor packets may be invalidated");
    const inputs = await collectKeyResetInputs(rpc, plan);
    const proof = verifyKeyReset(plan, inputs); // Fresh proof, inside locks; report files are not authorization.
    assertMaintenance();
    const observation = { transactionHash: plan.oldHash, finalized: false, state: "INVALIDATED", reason: "KEY_RESET_NONCE",
      events: [], needsReconciliation: false, keyResetProof: proof,
      disposition: "Old packet nonce invalidated by verified FINAL key reset; this is not on-chain settlement or proof it never existed." };
    await tx.nearTransaction.update({ where: { scope_hash: { scope, hash: plan.oldHash } },
      data: { state: "INVALIDATED", reason: "KEY_RESET_NONCE", observation: JSON.stringify(observation) } });
    return observation;
  }, { timeout: 120_000, maxWait: 5_000 });
}
