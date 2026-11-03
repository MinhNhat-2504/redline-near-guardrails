// Synthetic RPC fixtures only; no public key reset/signature/transaction performed.
import { describe, expect, it } from "vitest";
import { verifyKeyReset } from "../src/near/key-reset.js";
import { fixture, block, publicKey } from "./near-key-reset-fixture.js";

describe("read-only finalized scoped key reset verification", () => {
  it("proves nonce invalidation without declaring settlement or mutating a journal", () => {
    const { plan, input } = fixture(); const before = JSON.stringify({ plan, input });
    expect(verifyKeyReset(plan, input)).toMatchObject({ status: "VERIFIED_KEY_RESET_ONLY", finalizedKeyNonce: "11", oldKeyNonce: "10", originalIntentAbsent: true, financialBaselinesUnchanged: true, journalChanged: false, replacementSigned: false });
    expect(JSON.stringify({ plan, input })).toBe(before);
  });
  it.each([
    ["non-final reset", (i: any) => { i.reset.final_execution_status = "INCLUDED"; }],
    ["failed receipt", (i: any) => { i.reset.receipts_outcome[0] = { block_hash: block, outcome: { status: { Failure: {} } } }; }],
    ["extra action", (i: any) => { i.reset.transaction.actions.push({ Transfer: { deposit: "1" } }); }],
    ["wrong signer", (i: any) => { i.reset.transaction.signer_id = "other.testnet"; }],
    ["wrong receiver", (i: any) => { i.reset.transaction.receiver_id = "other.testnet"; }],
    ["same scoped signer", (i: any) => { i.reset.transaction.public_key = publicKey; }],
    ["broadened key", (i: any) => { i.reset.transaction.actions[1].AddKey.access_key.permission = "FullAccess"; }],
    ["increased allowance", (i: any) => { i.reset.transaction.actions[1].AddKey.access_key.permission = { FunctionCall: { receiver_id: "vault.testnet", method_names: ["execute_transfer"], allowance: "200000000000000000000000" } }; }],
    ["different public key", (i: any) => { i.reset.transaction.actions[1].AddKey.public_key = "ed25519:other"; }],
    ["nonzero add-key nonce", (i: any) => { i.reset.transaction.actions[1].AddKey.access_key.nonce = "1"; }],
    ["unchanged nonce", (i: any) => { i.access.nonce = "10"; }],
    ["stale access snapshot", (i: any) => { i.access.block_height = 100; }],
    ["missing execution block", (i: any) => { i.blocks = []; }],
    ["ambiguous execution block", (i: any) => { i.blocks.push(i.blocks[0]); }],
    ["unavailable original transaction", (i: any) => { i.originalUnknown = false; }],
    ["existing on-chain intent", (i: any) => { i.intent.value = { status: "PENDING" }; }],
    ["advanced contract nonce", (i: any) => { i.grant.value.next_nonce = "1"; }],
    ["reserved contract funds", (i: any) => { i.grant.value.pending_reserved = "1"; }],
    ["different policy", (i: any) => { i.grant.value.policy = { ...i.grant.value.policy, cooldown_ns: "1" }; }],
    ["changed principal", (i: any) => { i.ledger.value = { ...i.ledger.value, credited: "700000000000000000000000" }; }],
    ["changed payee balance", (i: any) => { i.payee.amount = "10060000000000000000000000"; }],
    ["financial snapshot before reset", (i: any) => { i.intent.blockHeight = 100; }],
  ])("refuses %s", (_name, mutate) => {
    const { plan, input } = fixture(); mutate(input); expect(() => verifyKeyReset(plan, input)).toThrow();
  });
  it("flags expiry without silently issuing a new grant", () => {
    const { plan, input } = fixture(); (plan.policy as any).expires_at_ns = "1";
    expect(verifyKeyReset(plan, input).grantExpiredAtVerification).toBe(true);
  });
});
