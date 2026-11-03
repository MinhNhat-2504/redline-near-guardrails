import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { NearChain } from "../chain/near.js";
import { accountId, hashId } from "./types.js";
import { terminalStates, nonRetryableStates } from "./store.js";
import { NearRpcError } from "./rpc.js";

const blockSchema = z.object({ header: z.object({ height: z.number().int().nonnegative().safe(), hash: hashId, prev_hash: hashId }),
  chunks: z.array(z.object({ chunk_hash: hashId, height_included: z.number().int().nonnegative().safe() })) });
const chunkSchema = z.object({ transactions: z.array(z.object({ hash: hashId, signer_id: accountId, receiver_id: accountId })) });

/** Finalized block discovery for DIRECT vault calls. Never skips a failed block. */
export class NearIndexer {
  constructor(private readonly chain: NearChain, private readonly startBlock: number) {
    if (!Number.isSafeInteger(startBlock) || startBlock < 0) throw new Error("Explicit safe NEAR start block required");
  }

  async refreshProjection(observation: { events: { data: unknown[] }[] }) {
    const ids = new Set<string>();
    for (const event of observation.events) for (const row of event.data) {
      if (row && typeof row === "object" && "grant_id" in row && typeof row.grant_id === "string") ids.add(row.grant_id);
    }
    for (const id of ids) await this.chain.readGrant(id); // monotonic finalized snapshot, no event arithmetic
  }

  async reconcileJournal(limit = 25): Promise<number> {
    const rows = await this.chain.db.nearTransaction.findMany({ where: { scope: this.chain.store.scope, state: { notIn: nonRetryableStates } }, orderBy: { createdAt: "asc" }, take: limit });
    let resolved = 0;
    for (const row of rows) {
      try {
        const observation = row.signedBase64 ? await this.chain.resumePrepared(row) : await this.chain.track(row.hash, row.signerId);
        if (observation.finalized && terminalStates.includes(observation.state)) resolved++;
        await this.refreshProjection(observation);
      } catch { /* Remains in the durable journal; do not block unrelated finalized block discovery. */ }
    }
    return resolved;
  }

  async scan(maxBlocks = 5): Promise<number> {
    if (!Number.isInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 100) throw new Error("Invalid block batch size");
    const scope = this.chain.store.scope;
    const latest = blockSchema.parse(await this.chain.rpc.finalBlock());
    let completed = 0;
    for (let index = 0; index < maxBlocks; index++) {
      const cursor = await this.chain.db.nearWatermark.findUnique({ where: { scope } });
      let height = cursor ? Number(cursor.height) + 1 : this.startBlock;
      if (!Number.isSafeInteger(height) || height > latest.header.height) break;
      let block: z.infer<typeof blockSchema> | undefined;
      // Skipped heights are safe only with an explicit UNKNOWN_BLOCK response
      // and a subsequent header whose prev_hash proves continuity to our cursor.
      for (let skipped = 0; skipped < 20 && height <= latest.header.height; skipped++, height++) {
        try { block = blockSchema.parse(await this.chain.rpc.finalBlock(height)); break; }
        catch (error) { if (!(error instanceof NearRpcError) || error.remoteName !== "UNKNOWN_BLOCK") throw error; }
      }
      if (!block) throw new Error("Cannot prove next finalized block continuity");
      if (block.header.height !== height || (cursor && block.header.prev_hash !== cursor.hash)) throw new Error("Finalized block continuity mismatch");
      for (const chunk of block.chunks) {
        if (chunk.height_included !== height) continue; // repeated chunk from previous height
        const contents = chunkSchema.parse(await this.chain.rpc.chunk(chunk.chunk_hash));
        for (const tx of contents.transactions) {
          if (tx.receiver_id !== this.chain.config.contractId) continue;
          const observation = await this.chain.track(tx.hash, tx.signer_id);
          if (!observation.finalized || !terminalStates.includes(observation.state)) throw new Error("Vault transaction remains unresolved; watermark retained");
          await this.refreshProjection(observation);
        }
      }
      await this.chain.db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ":watermark"}, 0))`;
        const current = await tx.nearWatermark.findUnique({ where: { scope } });
        if (current && current.height >= BigInt(height)) return; // another reader finished it
        if ((current?.height ?? null) !== (cursor?.height ?? null)) throw new Error("Indexer cursor changed; retry block");
        await tx.nearWatermark.upsert({ where: { scope }, create: { scope, height: BigInt(height), hash: block.header.hash }, update: { height: BigInt(height), hash: block.header.hash } });
      });
      completed++;
    }
    return completed;
  }
}
