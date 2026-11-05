import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./api", () => ({ api: vi.fn(), setToken: vi.fn() }));
vi.mock("@near-wallet-selector/core", () => ({ setupWalletSelector: vi.fn() }));
vi.mock("@near-wallet-selector/intear-wallet", () => ({ setupIntearWallet: vi.fn(() => ({})) }));
import { api, setToken } from "./api";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { finishCallback, login } from "./wallet";
const c = { challengeId: "a".repeat(64), state: "s".repeat(43), accountId: "owner.testnet", message: "Sign-in only", nonce: "n".repeat(44), recipient: "localhost:5173", callbackUrl: "http://localhost:5173/near/auth/callback" };
const walletPort = { type: "injected", getAccounts: vi.fn(), signIn: vi.fn(), signMessage: vi.fn(), signAndSendTransaction: vi.fn() };
let saved: Map<string, string>, replace: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); saved = new Map([["near-challenge", JSON.stringify(c)]]);
  const location = { pathname: "/near/auth/callback", origin: "http://localhost:5173", host: "localhost:5173", hash: `#accountId=${c.accountId}&publicKey=public&signature=signed&state=${c.state}` };
  replace = vi.fn(() => { location.pathname = "/near"; location.hash = ""; });
  vi.stubGlobal("location", location); vi.stubGlobal("history", { replaceState: replace });
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) });
  vi.mocked(setupWalletSelector).mockResolvedValue({ wallet: async () => walletPort } as any);
});
afterEach(() => vi.unstubAllGlobals());
describe("wallet cancellation and callback retry with synthetic transport (not browser E2E)", () => {
  it("keeps callback/challenge on API failure, then verifies the same callback on retry", async () => {
    vi.mocked(api).mockRejectedValueOnce(Error("API 503")).mockResolvedValueOnce({ token: "t".repeat(43), accountId: c.accountId });
    await expect(finishCallback()).rejects.toThrow("503");
    expect(replace).not.toHaveBeenCalled(); expect(saved.has("near-challenge")).toBe(true); expect(setToken).not.toHaveBeenCalled();
    await expect(finishCallback()).resolves.toBe(c.accountId);
    expect(vi.mocked(api).mock.calls[0]).toEqual(vi.mocked(api).mock.calls[1]);
    expect(replace).toHaveBeenCalledOnce(); expect(saved.has("near-challenge")).toBe(false);
    await expect(finishCallback()).resolves.toBeUndefined(); expect(api).toHaveBeenCalledTimes(2);
  });
  it("mismatched callback state cannot verify or consume the saved challenge", async () => {
    location.hash = "#signature=signed&state=wrong";
    await expect(finishCallback()).rejects.toThrow("state");
    expect(api).not.toHaveBeenCalled(); expect(setToken).not.toHaveBeenCalled(); expect(saved.has("near-challenge")).toBe(true);
  });
  it.each([{ accountId: "foreign.testnet", token: "t".repeat(43) }, { accountId: c.accountId, token: "invalid" }])("rejects a substituted session response %#", async result => {
    vi.mocked(api).mockResolvedValueOnce(result); await expect(finishCallback()).rejects.toThrow("khớp");
    expect(setToken).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
  });
  it("wallet connection cancellation creates no challenge or financial call", async () => {
    walletPort.getAccounts.mockResolvedValueOnce([]); walletPort.signIn.mockRejectedValueOnce(Error("User rejected"));
    await expect(login()).rejects.toThrow("User rejected"); expect(api).not.toHaveBeenCalled(); expect(walletPort.signAndSendTransaction).not.toHaveBeenCalled();
  });
  it("message cancellation creates no authenticated session or financial call", async () => {
    walletPort.getAccounts.mockResolvedValueOnce([{ accountId: c.accountId }]); vi.mocked(api).mockResolvedValueOnce(c);
    walletPort.signMessage.mockRejectedValueOnce(Error("User rejected message"));
    await expect(login()).rejects.toThrow("User rejected message");
    expect(api).toHaveBeenCalledTimes(1); expect(vi.mocked(api).mock.calls[0][0]).toBe("/near/auth/challenge");
    expect(setToken).not.toHaveBeenCalled(); expect(walletPort.signAndSendTransaction).not.toHaveBeenCalled();
  });
});
