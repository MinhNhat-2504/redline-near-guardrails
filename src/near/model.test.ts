import { describe, expect, it } from "vitest";
import { available, CAP, CONTRACT, EXECUTOR, PAYEE, assertIdentity, near, remainingSeconds, transfer, validateProposal, type Grant, type Proposal } from "./model";
const now = 1793709971164;
const grant: Grant = { owner: "alice.testnet", active: true, next_nonce: "1", finalized_spent: "10000000000000000000000", pending_reserved: "10000000000000000000000", finalized_transactions: 1, pending_transactions: 1, policy: { executor: EXECUTOR, policy_hash: "a".repeat(64), spend_cap: CAP, max_transactions: 3, recipients: [PAYEE], expires_at_ns: ((BigInt(now) + 3600000n) * 1000000n).toString(), cooldown_ns: "0" } };
async function proposal(): Promise<Proposal> {
  const c = JSON.stringify({ schema: "redline.near.policy.v1", network: "testnet", contract_id: CONTRACT, owner_id: grant.owner, grant_id: "grant-test", executor: EXECUTOR, asset: "NEAR", spend_cap: CAP, max_transactions: 3, recipients: [PAYEE], expires_at_ns: grant.policy.expires_at_ns, cooldown_ns: "0" });
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(c))), b => b.toString(16).padStart(2, "0")).join("");
  return { network: "testnet", signerId: grant.owner, unsigned: true, canonicalPolicy: c, transaction: { receiverId: CONTRACT, actions: [{ type: "FunctionCall", params: { methodName: "create_grant", args: { grant_id: "grant-test", policy: { ...grant.policy, policy_hash: digest } }, deposit: "0", gas: "100000000000000" } }] } };
}
describe("NEAR browser authority and accounting boundaries (unit, not chain proof)", () => {
  it("formats yocto exactly beyond Number precision", () => { expect(near("10000000000000000000001")).toBe("0.010000000000000000000001"); expect(near("0")).toBe("0"); });
  it("subtracts pending transfers and withdrawals from principal, excluding storage", () => { expect(available({ credited: "100", finalized_spent: "20", pending_reserved: "30", completed_withdrawals: "10", pending_withdrawals: "5", storage_available: "9000" })).toBe("35"); });
  it("expiry is clamped and login never affects the deadline", () => { expect(remainingSeconds(grant, now)).toBe(3600); expect(remainingSeconds(grant, now + 3600001)).toBe(0); });
  it("fails closed on Solana, mainnet, wrong contract or missing auth enforcement", () => { const h = { chain: "near", network: "testnet", contractId: CONTRACT, executorId: EXECUTOR, identityEnforced: true }; expect(() => assertIdentity(h)).not.toThrow(); for (const patch of [{ chain: "solana" }, { network: "mainnet" }, { contractId: "evil.testnet" }, { identityEnforced: false }]) expect(() => assertIdentity({ ...h, ...patch })).toThrow(); });
  it("binds attack scenarios to reviewed grant without changing asset or hash", () => { const r = transfer(grant, "g", "allow"); expect(r.amount).toBe("10000000000000000000000"); expect(r.recipient).toBe(PAYEE); expect(r.nonce).toBe("1"); expect(transfer(grant, "g", "cap").amount).toBe((BigInt(CAP) + 1n).toString()); expect(transfer(grant, "g", "recipient").recipient).toBe(grant.owner); expect(transfer(grant, "g", "replay").nonce).toBe("0"); });
  it("accepts an exactly bound unsigned policy", async () => { await expect(validateProposal(await proposal(), grant.owner, "create_grant", undefined, now)).resolves.toBeUndefined(); });
  it.each(["receiver", "deposit", "executor", "cap", "payee", "hash", "canonical", "extraAction", "extraField"])("refuses server proposal tampering: %s", async kind => { const p = await proposal(); const params = p.transaction.actions[0].params; const policy = params.args.policy as Grant["policy"];
    if (kind === "receiver") p.transaction.receiverId = "evil.testnet";
    if (kind === "deposit") params.deposit = "1";
    if (kind === "executor") policy.executor = "evil.testnet";
    if (kind === "cap") policy.spend_cap = "999";
    if (kind === "payee") policy.recipients = [grant.owner];
    if (kind === "hash") policy.policy_hash = "0".repeat(64);
    if (kind === "canonical") p.canonicalPolicy = p.canonicalPolicy!.replace('"testnet"', '"mainnet"');
    if (kind === "extraAction") p.transaction.actions.push(p.transaction.actions[0]);
    if (kind === "extraField") params.args.surprise = "value";
    await expect(validateProposal(p, grant.owner, "create_grant", undefined, now)).rejects.toThrow();
  });
  it("refuses expired or more than eight-hour authority", async () => { await expect(validateProposal(await proposal(), grant.owner, "create_grant", undefined, now + 3600001)).rejects.toThrow(); await expect(validateProposal(await proposal(), grant.owner, "create_grant", undefined, now - 8 * 3600000)).rejects.toThrow(); });
  it("refuses revocation of a different grant", async () => { const p = await proposal(); p.transaction.actions[0].params.methodName = "revoke_grant"; p.transaction.actions[0].params.args = { grant_id: "other" }; await expect(validateProposal(p, grant.owner, "revoke_grant", "reviewed", now)).rejects.toThrow(); });
});
