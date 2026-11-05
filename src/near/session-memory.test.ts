import { describe, expect, it } from "vitest";
import { sessionMemory } from "./session-memory";
describe("session memory across lazy module and HMR closures, not actual browser acceptance", () => {
  it("an old wallet writer and re-evaluated API reader share the same live object", () => {
    const hotData = {}, oldApi = sessionMemory(hotData), oldWalletSet = (value: string) => { oldApi.token = value; oldApi.revision++; };
    const newApi = sessionMemory(hotData);
    oldWalletSet("synthetic-test-session");
    expect(newApi.token).toBe("synthetic-test-session"); expect(newApi).toBe(oldApi);
    newApi.token = ""; newApi.revision++; expect(oldApi.token).toBe("");
  });
  it("fresh page or separate tab has no token and no browser-storage access", () => {
    const previous = sessionMemory({}); previous.token = "synthetic-test-session";
    expect(sessionMemory({}).token).toBe(""); expect(sessionMemory().token).toBe("");
  });
  it.each([null, { token: 1, revision: 0 }, { token: "", revision: -1 }])("does not trust invalid HMR data %#", value => expect(() => sessionMemory({ nearSessionMemory: value })).toThrow());
});
