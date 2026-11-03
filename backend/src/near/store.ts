import { Prisma, type PrismaClient } from "@prisma/client";
import type { VaultObservation } from "./receipts.js";
import type { ReceiptCheckpointStore } from "./reader.js";
import { grantSchema, viewSchema } from "./types.js";

export const terminalStates = ["SETTLED", "FAILED", "REJECTED", "RUNTIME_FAILED", "CONFIRMED"];

export class NearStore implements ReceiptCheckpointStore {
  constructor(readonly db: PrismaClient, readonly scope: string) {}

  async has(hash: string): Promise<boolean> {
    const row = await this.db.nearTransaction.findUnique({ where: { scope_hash: { scope: this.scope, hash } } });
    return Boolean(row && terminalStates.includes(row.state));
  }

  async track(hash: string, signerId: string) {
    const row = await this.db.nearTransaction.upsert({ where: { scope_hash: { scope: this.scope, hash } },
      create: { scope: this.scope, hash, signerId }, update: {} });
    if (row.signerId !== signerId) throw new Error("Tracked transaction signer mismatch");
    return row;
  }

  async commit(hash: string, observation: VaultObservation): Promise<void> {
    if (!observation.finalized || !terminalStates.includes(observation.state) || observation.transactionHash !== hash) throw new Error("Cannot checkpoint unresolved observation");
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.scope + ":tx:" + hash}, 0))`;
      const row = await tx.nearTransaction.findUniqueOrThrow({ where: { scope_hash: { scope: this.scope, hash } } });
      if (terminalStates.includes(row.state)) {
        if (row.observation !== JSON.stringify(observation)) throw new Error("Conflicting finalized observation");
        return;
      }
      if (observation.events.length) await tx.nearReceiptEvent.createMany({ data: observation.events.map(event => ({
        scope: this.scope, id: event.id, txHash: hash, receiptId: event.receiptId, logIndex: event.logIndex,
        event: event.event, dataJson: JSON.stringify(event.data),
      })), skipDuplicates: true });
      let grantId = row.grantId, intentId = row.intentId, ownerId = row.ownerId;
      for (const event of observation.events) for (const value of event.data) {
        if (!value || typeof value !== "object") continue;
        const data = value as Record<string, unknown>;
        if (typeof data.grant_id === "string") grantId = data.grant_id;
        if (typeof data.intent_id === "string") intentId = data.intent_id;
        if (typeof data.owner === "string") ownerId ??= data.owner;
        if (data.grant && typeof data.grant === "object" && "owner" in data.grant && typeof data.grant.owner === "string") ownerId ??= data.grant.owner;
      }
      if (grantId && !ownerId) ownerId = (await tx.nearGrant.findUnique({ where: { scope_grantId: { scope: this.scope, grantId } } }))?.ownerId ?? null;
      await tx.nearTransaction.update({ where: { scope_hash: { scope: this.scope, hash } },
        data: { state: observation.state, reason: observation.reason, observation: JSON.stringify(observation), grantId, intentId, ownerId } });
    });
  }

  async saveGrant(grantId: string, input: unknown) {
    const snapshot = viewSchema(grantSchema).parse(input);
    const g = snapshot.value;
    const data = { ownerId: g.owner, executorId: g.policy.executor, active: g.active, policyJson: JSON.stringify(g.policy),
      spentYocto: new Prisma.Decimal(g.finalized_spent), pendingYocto: new Prisma.Decimal(g.pending_reserved),
      nextNonce: new Prisma.Decimal(g.next_nonce), finalizedTransactions: new Prisma.Decimal(g.finalized_transactions),
      pendingTransactions: new Prisma.Decimal(g.pending_transactions), observedHeight: BigInt(snapshot.blockHeight), observedHash: snapshot.blockHash };
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.scope + ":grant:" + grantId}, 0))`;
      const current = await tx.nearGrant.findUnique({ where: { scope_grantId: { scope: this.scope, grantId } } });
      if (current && current.observedHeight > data.observedHeight) return;
      if (current && current.observedHeight === data.observedHeight && current.observedHash !== data.observedHash) throw new Error("Conflicting finalized grant block");
      await tx.nearGrant.upsert({ where: { scope_grantId: { scope: this.scope, grantId } }, create: { scope: this.scope, grantId, ...data }, update: data });
    });
    return snapshot;
  }
}
