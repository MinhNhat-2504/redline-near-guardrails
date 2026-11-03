// Pure helper/config tests and real canonical hashing; no keys, RPC or chain writes.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { parseDemoGrantOptions, makeDemoValidity, checkStoredDemoValidity } from "../src/near/demo-validity.js";
import { prepareOwnerAction } from "../src/near/owner-actions.js";
import type { NearChain } from "../src/chain/near.js";
const NOW = 1793707200000;
describe("explicit demo validity bounded by owner's eight-hour approval",()=>{
  it("keeps one-hour default and accepts explicit1..8h in either CLI order",()=>{
    expect(parseDemoGrantOptions([])).toEqual({mode:'initial',hours:undefined});
    expect(makeDemoValidity(undefined,NOW).expiresAtNs).toBe(((BigInt(NOW)+3600000n)*1000000n).toString());
    for(let hours=1;hours<=8;hours++){
      expect(parseDemoGrantOptions(['--renew-expired-grant','--grant-hours',String(hours)])).toEqual({mode:'renew-expired-grant',hours});
      expect(parseDemoGrantOptions(['--grant-hours',String(hours),'--after-key-reset'])).toEqual({mode:'after-key-reset',hours});
    }
  });
  it.each(['0','9','24','-1','1.5','8.0','08','Infinity','NaN',''])('rejects invalid/over-approved duration %s',value=>{
    expect(()=>parseDemoGrantOptions(['--grant-hours',value])).toThrow();
  });
  it("rejects ambiguous/missing/unknown CLI options before any session read",()=>{
    for(const args of [['--grant-hours'],['--grant-hours','8','--grant-hours','1'],['--after-key-reset','--renew-expired-grant'],['--unknown']])expect(()=>parseDemoGrantOptions(args)).toThrow();
    expect(()=>makeDemoValidity(9,NOW)).toThrow();expect(()=>makeDemoValidity(1,Number.MAX_SAFE_INTEGER)).toThrow();
  });
  it("preserves exact eight-hour deadline on retry even without repeating the option",()=>{
    const saved=makeDemoValidity(8,NOW);const before=JSON.stringify(saved);
    expect(checkStoredDemoValidity(saved,saved.expiresAtNs,undefined,NOW+3600000)).toBe(8);
    expect(checkStoredDemoValidity(saved,saved.expiresAtNs,8,NOW+3600000)).toBe(8);
    expect(JSON.stringify(saved)).toBe(before);
    expect(()=>checkStoredDemoValidity(saved,saved.expiresAtNs,1,NOW+3600000)).toThrow('duration differs');
    expect(()=>checkStoredDemoValidity(undefined,saved.expiresAtNs,8,NOW)).toThrow('Legacy');
  });
  it("refuses changed deadline, forged duration and future preparation time",()=>{
    const saved=makeDemoValidity(8,NOW);
    expect(()=>checkStoredDemoValidity(saved,(BigInt(saved.expiresAtNs)+1n).toString(),8,NOW)).toThrow('deadline differs');
    expect(()=>checkStoredDemoValidity({...saved,hours:9},saved.expiresAtNs,undefined,NOW)).toThrow();
    expect(()=>checkStoredDemoValidity(saved,saved.expiresAtNs,8,NOW-30001)).toThrow('future');
  });
  it("binds the chosen eight-hour expiry in actual unsigned owner canonical policy without changing spend/method/recipient scope",async()=>{
    const validity=makeDemoValidity(8,NOW);
    const chain={config:{contractId:'vault.testnet',executorId:'agent.testnet'}} as NearChain;
    const draft=await prepareOwnerAction(chain,'owner.testnet',{method:'create_grant',policy:{spend_cap:'50000000000000000000000',max_transactions:3,recipients:['payee.testnet'],expires_at_ns:validity.expiresAtNs,cooldown_ns:'0'}},NOW);
    expect(draft.unsigned).toBe(true);expect(draft.transaction.actions).toHaveLength(1);
    const params=draft.transaction.actions[0].params;const policy=(params.args as any).policy;
    expect(params.deposit).toBe('0');expect(policy).toMatchObject({spend_cap:'50000000000000000000000',max_transactions:3,recipients:['payee.testnet'],executor:'agent.testnet',expires_at_ns:validity.expiresAtNs,cooldown_ns:'0'});
    const canonical=JSON.parse(draft.canonicalPolicy!);
    expect(canonical.expires_at_ns).toBe(((BigInt(NOW)+8n*3600000n)*1000000n).toString());
    expect(createHash('sha256').update(draft.canonicalPolicy!).digest('hex')).toBe(policy.policy_hash);
    canonical.expires_at_ns=makeDemoValidity(1,NOW).expiresAtNs;
    expect(createHash('sha256').update(JSON.stringify(canonical)).digest('hex')).not.toBe(policy.policy_hash);
  });
});
