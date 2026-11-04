import { z } from "zod";
import { accountId, amount, hashId } from "./types.js";
import type { NearReadOnlyRpc } from "./rpc.js";

/** Raw native account balance, distinct from vault principal and spendable gas. */
export async function accountSnapshot(rpc: NearReadOnlyRpc, account: string) {
  accountId.parse(account);
  const raw = z.object({ amount, locked: amount, storage_usage: z.number().int().nonnegative().safe(),
    block_height: z.number().int().nonnegative().safe(), block_hash: hashId }).parse(await rpc.account(account));
  return { network: "testnet" as const, accountId: account, amount: raw.amount, locked: raw.locked,
    storageUsage: raw.storage_usage, blockHeight: raw.block_height, blockHash: raw.block_hash };
}
