// Public Testnet reads only: no credentials, session, database or broadcast.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { observeWithdrawal } from "../src/near/withdrawal.js";

async function main() {
  const [output] = process.argv.slice(2);
  if (!output || output === "--help") {
    console.log("Read-only verification of owner-supplied web withdrawal: <new-evidence.json>"); return;
  }
  const hash = "AwCQh5ceQyom6WM46TkmaDdJG2AFBFQwvvcu8KrWcMHp";
  const owner = "nhat-redline-web.testnet", vault = "nhat-redline-vault.testnet";
  const withdrawalId = "wd-e12b9f4c0b2b43fa970643db7d0970f8";
  const amount = "10000000000000000000000";
  const rpc = new NearReadOnlyRpc(); await rpc.connect();
  const transaction: any = await rpc.transaction(hash, owner);
  const observation = observeWithdrawal(transaction, vault, owner, { hash, withdrawalId, amount, minBlockHeight: 0 });
  assert.equal(observation.finalized, true); assert.equal(observation.state, "SETTLED");
  const callback = observation.events.find(e => e.event === "withdrawal_completed");
  assert.ok(callback);
  const receipt = transaction.receipts_outcome.find((r: any) => r.id === callback.receiptId);
  assert.ok(receipt);
  const executionBlock: any = await rpc.blockAtHash(receipt.block_hash);
  assert.equal(executionBlock.header.hash, receipt.block_hash);
  const finalBlock: any = await rpc.finalBlock();
  assert.ok(finalBlock.header.height >= executionBlock.header.height);
  const withdrawal: any = await rpc.view(vault, "get_withdrawal", { owner, withdrawal_id: withdrawalId }, finalBlock.header.hash);
  const ledger: any = await rpc.view(vault, "get_owner_balance", { owner }, finalBlock.header.hash);
  for (const view of [withdrawal, ledger]) {
    assert.equal(view.blockHash, finalBlock.header.hash); assert.equal(view.blockHeight, finalBlock.header.height);
  }
  assert.deepEqual(withdrawal.value, { amount, status: "SETTLED" });
  assert.equal(ledger.value.completed_withdrawals, amount);
  assert.equal(ledger.value.pending_withdrawals, "0");
  const l = ledger.value;
  const available = BigInt(l.credited) - BigInt(l.finalized_spent) - BigInt(l.pending_reserved) - BigInt(l.completed_withdrawals) - BigInt(l.pending_withdrawals);
  assert.equal(available, 80000000000000000000000n);
  const report = { status: "VERIFIED_FINAL_WEB_WITHDRAWAL", capturedAt: new Date().toISOString(), network: "testnet", hash, owner, contractId: vault, withdrawalId, amount, observation, transaction, executionBlock, finalBlock, withdrawal, ledger, available: available.toString(),
    limitations: "Public RPC receipt/callback and same-block FINAL views verified. Original browser durable attempt/baseline, wallet clicks and pre/post wallet balance delta not independently captured. No full Phase4/5 PASS inferred." };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, hash, withdrawalId, amount, finalized: observation.finalized, state: observation.state, finalBlockHeight: finalBlock.header.height, ledger: ledger.value, available: report.available }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public withdrawal verification failed"); process.exitCode = 1; });
