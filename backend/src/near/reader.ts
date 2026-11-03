import { observeVaultTransaction, type VaultObservation } from "./receipts.js";

export interface TrackedTransaction { hash: string; signer: string }
export interface ReceiptCheckpointStore {
  /** Must be durable, isolated by network/contract, and unique by hash. */
  has(hash: string): Promise<boolean>;
  /** Atomically persist observation/events and checkpoint; unique event.id dedupes retry. */
  commit(hash: string, observation: VaultObservation): Promise<void>;
}

/** Reconciles a known transaction journal. Does NOT discover arbitrary account history. */
export class NearReceiptReader {
  constructor(
    private readonly contract: string,
    private readonly rpc: { transaction(hash: string, signer: string): Promise<unknown> },
    private readonly store: ReceiptCheckpointStore,
  ) {}

  async reconcile(entry: TrackedTransaction): Promise<VaultObservation | null> {
    if (await this.store.has(entry.hash)) return null;
    const observation = observeVaultTransaction(await this.rpc.transaction(entry.hash, entry.signer), this.contract, entry.hash, entry.signer);
    // Unresolved FINAL/PENDING is not final accounting; keep reconcilable.
    if (observation.finalized && observation.state !== "UNKNOWN" && observation.state !== "PENDING") {
      await this.store.commit(entry.hash, observation);
    }
    return observation;
  }
}
