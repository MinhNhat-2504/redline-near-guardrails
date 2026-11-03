import { describe, expect, it } from "vitest";
import { assertDemoSubmission } from "../src/near/demo-preflight.js";
import { fixture } from "./near-key-reset-fixture.js";
describe("safe demo helper expiry guard (no network or wallet)",()=>{
  it("refuses a saved local request after deadline without treating local persistence as a durable submission",()=>{
    const {plan,input}=fixture(); const grant=(input.grant as any).value;
    grant.policy.expires_at_ns="1000000000";
    expect(()=>assertDemoSubmission(grant,plan.args,false,1001)).toThrow("Grant expired");
  });
  it("allows identical durable packet reconciliation after expiry",()=>{
    const {plan,input}=fixture(); const grant=(input.grant as any).value;grant.policy.expires_at_ns="1";grant.next_nonce="1";
    expect(()=>assertDemoSubmission(grant,plan.args,true,1001)).not.toThrow();
  });
  it("rejects new submissions inside the30s buffer",()=>{
    const {plan,input}=fixture();const grant=(input.grant as any).value;grant.policy.expires_at_ns="31000000000";
    expect(()=>assertDemoSubmission(grant,plan.args,false,1000)).toThrow("Grant expired");
  });
  it("allows a bounded fresh request, but blocks changed nonce and policy",()=>{
    const {plan,input}=fixture(); const grant=(input.grant as any).value;
    expect(()=>assertDemoSubmission(grant,plan.args,false,1000)).not.toThrow();
    grant.next_nonce="1";expect(()=>assertDemoSubmission(grant,plan.args,false,1000)).toThrow("nonce changed");
    grant.policy={...grant.policy,policy_hash:"b".repeat(64)};
    expect(()=>assertDemoSubmission(grant,plan.args,true,1000)).toThrow("policy changed");
  });
});
