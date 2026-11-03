// Explicit read-only live check; not part of offline unit tests. No wallet/key access.
import assert from "node:assert/strict";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { observeVaultTransaction } from "../src/near/receipts.js";

const rpc = new NearReadOnlyRpc();
const vault = "nhat-redline-vault.testnet";
const agent = "nhat-redline-agent.testnet";
await rpc.connect();
const receipts = [];
for (const [hash, state, reason] of [
  ["3MVR1WBn7C5XLk9KriUuT2ujqqkZPkTqnnNVdEgQMrg1", "SETTLED", "OK"],
  ["J1P7eMu612YPEaMryf6VrWedmXiM6BazgoQW8mUQwb4x", "REJECTED", "SPEND_CAP_EXCEEDED"],
  ["8MCrqH1rQXTPvfuG6Yk9TuAVXgGo7mj55rmfMvNL9DuB", "REJECTED", "DESTINATION_NOT_ALLOWED"],
  ["4huc1hEC2EF3jEft21Ga7xBvoFMCuvzsCTsiLWJkGBU4", "REJECTED", "REVOKED"],
]) {
  const observation = observeVaultTransaction(await rpc.transaction(hash, agent), vault, hash, agent);
  assert.equal(observation.finalized, true); assert.equal(observation.state, state); assert.equal(observation.reason, reason);
  receipts.push(observation);
}
const ledger = await rpc.view(vault, "get_owner_balance", { owner: "nhat-redline-owner.testnet" });
console.log(JSON.stringify({ result: "PASS", scope: "live read-only Testnet RPC; no signing, API routes, database or wallet integration", receipts, ledger }, null, 2));
