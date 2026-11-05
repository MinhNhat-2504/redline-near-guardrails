import { z } from "zod";
import { hashId, httpError, positiveAmount, recordId, viewSchema } from "./types.js";
import { decodeBase64Json, observeVaultTransaction } from "./receipts.js";
import type { NearChain } from "../chain/near.js";
export const withdrawalExpected = z.object({ hash: hashId, withdrawalId: recordId, amount: positiveAmount, minBlockHeight: z.number().int().nonnegative().safe() }).strict();
export function observeWithdrawal(input: unknown, contract: string, owner: string, expected: z.infer<typeof withdrawalExpected>) {
  const observation = observeVaultTransaction(input, contract, expected.hash, owner);
  const tx = z.object({ transaction: z.object({ actions: z.array(z.object({ FunctionCall: z.object({ method_name: z.literal("withdraw"), deposit: z.literal("0"), gas: z.union([z.string(), z.number().int().safe()]), args: z.string() }) }).strict()).length(1) }) }).parse(input);
  const call = tx.transaction.actions[0].FunctionCall;
  const args = z.object({ withdrawal_id: recordId, amount: positiveAmount }).strict().parse(decodeBase64Json(call.args));
  if (args.withdrawal_id !== expected.withdrawalId || args.amount !== expected.amount || BigInt(call.gas) !== 100000000000000n) throw httpError(409, "Withdrawal differs from reviewed owner request");
  return observation;
}
export async function reconcileWithdrawal(chain: NearChain, owner: string, input: unknown) {
  const expected = withdrawalExpected.parse(input), raw = await chain.rpc.transaction(expected.hash, owner);
  const observation = observeWithdrawal(raw, chain.config.contractId, owner, expected);
  if (!observation.finalized || !["SETTLED", "FAILED"].includes(observation.state)) return { ...observation, withdrawalId: expected.withdrawalId, amount: expected.amount, owner };
  const receipt = z.object({ receipts_outcome: z.array(z.object({ block_hash: hashId, outcome: z.object({ executor_id: z.string() }) })) }).parse(raw).receipts_outcome.find(r => r.outcome.executor_id === chain.config.contractId);
  if (!receipt) throw httpError(409, "Missing withdrawal execution receipt");
  const block = z.object({ header: z.object({ hash: hashId, height: z.number().int().nonnegative().safe() }) }).parse(await chain.rpc.blockAtHash(receipt.block_hash)).header;
  if (block.hash !== receipt.block_hash || block.height <= expected.minBlockHeight) throw httpError(409, "Withdrawal predates reviewed request");
  const stored = viewSchema(z.object({ amount: positiveAmount, status: z.enum(["SETTLED", "FAILED"]) }).strict()).parse(await chain.rpc.view(chain.config.contractId, "get_withdrawal", { owner, withdrawal_id: expected.withdrawalId }));
  if (stored.blockHeight < block.height || stored.value.amount !== expected.amount || stored.value.status !== observation.state) throw httpError(409, "Final withdrawal view does not match receipt");
  await chain.store.track(expected.hash, owner); await chain.store.commit(expected.hash, observation);
  return { ...observation, withdrawalId: expected.withdrawalId, amount: expected.amount, owner, executionBlockHeight: block.height };
}
