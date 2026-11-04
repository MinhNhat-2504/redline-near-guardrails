import { z } from "zod";
import { NearViewError, type NearReadOnlyRpc } from "./rpc.js";
import { accountId, positiveAmount, hashId, httpError, ledgerSchema, viewSchema } from "./types.js";
import { decodeBase64Json, observeVaultTransaction } from "./receipts.js";
import type { NearChain } from "../chain/near.js";

export async function fundingStatus(rpc: NearReadOnlyRpc, contract: string, owner: string) {
  accountId.parse(owner);
  try { return { registered: true as const, ...viewSchema(ledgerSchema).parse(await rpc.view(contract, "get_owner_balance", { owner })) }; }
  catch (error) {
    if (error instanceof NearViewError && error.method === "get_owner_balance" && error.remoteName === "STORAGE_REGISTRATION_REQUIRED") return { registered: false as const, blockHeight: error.blockHeight, blockHash: error.blockHash };
    throw error; // RPC outage and unknown panic must never become an invented zero ledger.
  }
}
export const reconcileFundingSchema = z.object({ hash: hashId, method: z.enum(["storage_deposit", "deposit"]), amount: positiveAmount, minBlockHeight: z.number().int().nonnegative().safe() }).strict();
export function observeFunding(input: unknown, contract: string, owner: string, expected: z.infer<typeof reconcileFundingSchema>) {
  const observation = observeVaultTransaction(input, contract, expected.hash, owner);
  const tx = z.object({ transaction: z.object({ actions: z.array(z.object({ FunctionCall: z.object({ method_name: z.string(), deposit: z.string(), args: z.string(), gas: z.union([z.string(), z.number().int().safe()]) }) }).strict()).length(1) }) }).parse(input);
  const call = tx.transaction.actions[0].FunctionCall;
  const args = z.record(z.string(), z.unknown()).parse(decodeBase64Json(call.args));
  if (call.method_name !== expected.method || call.deposit !== expected.amount || BigInt(call.gas) !== 100000000000000n || Object.keys(args).length !== 0) throw httpError(409, "Transaction does not match reviewed owner funding action");
  if (observation.finalized && observation.state === "CONFIRMED") {
    const status = z.object({ status: z.object({ SuccessValue: z.string() }) }).parse(input).status;
    ledgerSchema.parse(decodeBase64Json(status.SuccessValue));
  }
  return observation;
}
export async function reconcileFunding(chain: NearChain, owner: string, input: unknown) {
  const expected = reconcileFundingSchema.parse(input);
  const transaction = await chain.rpc.transaction(expected.hash, owner);
  const observation = observeFunding(transaction, chain.config.contractId, owner, expected);
  if (observation.finalized && observation.state === "CONFIRMED") {
    const receipt = z.object({ receipts_outcome: z.array(z.object({ block_hash: z.string(), outcome: z.object({ executor_id: z.string() }) })) }).parse(transaction).receipts_outcome.find(r => r.outcome.executor_id === chain.config.contractId);
    if (!receipt) throw httpError(409, "Missing funding execution receipt");
    const block = z.object({ header: z.object({ hash: z.string(), height: z.number().int().nonnegative().safe() }) }).parse(await chain.rpc.blockAtHash(receipt.block_hash));
    if (block.header.hash !== receipt.block_hash || block.header.height <= expected.minBlockHeight) throw httpError(409, "Funding transaction predates the reviewed proposal");
    await chain.store.track(expected.hash, owner);
    await chain.store.commit(expected.hash, observation);
    return { ...observation, method: expected.method, amount: expected.amount, executionBlockHeight: block.header.height };
  }
  return { ...observation, method: expected.method, amount: expected.amount };
}
