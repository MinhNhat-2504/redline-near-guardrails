import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getAccounts: vi.fn(), signIn: vi.fn(), signMessage: vi.fn(), api: vi.fn(), token: vi.fn() }));
vi.mock("@near-wallet-selector/core", () => ({ setupWalletSelector: async () => ({ wallet: async () => ({ type: "injected", ...mocks }) }) }));
vi.mock("@near-wallet-selector/intear-wallet", () => ({ setupIntearWallet: () => ({}) }));
vi.mock("./api", () => ({ api: mocks.api, setToken: mocks.token }));
import { login } from "./wallet";
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
function setup(callbackUrl = "http://localhost:5173/near/auth/callback") {
  vi.stubGlobal("location", { origin: "http://localhost:5173", host: "localhost:5173" });
  vi.stubGlobal("sessionStorage", { setItem: vi.fn(), removeItem: vi.fn() });
  mocks.getAccounts.mockResolvedValue([]); mocks.signIn.mockResolvedValue([{ accountId: "alice.testnet" }]);
  mocks.api.mockResolvedValueOnce({ challengeId: "c", state: "state", accountId: "alice.testnet", message: "Sign-in only", nonce: Buffer.alloc(32).toString("base64"), recipient: "localhost:5173", callbackUrl }).mockResolvedValueOnce({ accountId: "alice.testnet", token: "test-session" });
  mocks.signMessage.mockResolvedValue({ accountId: "alice.testnet", publicKey: "ed25519:test", signature: "signature" });
}
describe("wallet integration boundaries, mocked transport (not real wallet proof)", () => {
  it("connects identity-only without creating a FunctionCall key, then verifies NEP-413", async () => { setup(); expect(await login()).toBe("alice.testnet"); expect(mocks.signIn).toHaveBeenCalledWith({}); expect(mocks.signMessage.mock.calls[0][0].callbackUrl).toBe("http://localhost:5173/near/auth/callback"); expect(mocks.signMessage.mock.calls[0][0].nonce.length).toBe(32); expect(mocks.api.mock.calls[0][1]).toEqual({ accountId: "alice.testnet", clientType: "wallet" }); expect(mocks.token).toHaveBeenCalledWith("test-session"); });
  it("never signs a backend challenge with foreign callback origin", async () => { setup("https://evil.example/near/auth/callback"); await expect(login()).rejects.toThrow("Origin"); expect(mocks.signMessage).not.toHaveBeenCalled(); });
  it("rejects a wallet result for another account before session creation", async () => { setup(); mocks.signMessage.mockResolvedValue({ accountId: "mallory.testnet", publicKey: "ed25519:test", signature: "signature" }); await expect(login()).rejects.toThrow("tài khoản"); expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.api).toHaveBeenCalledTimes(1); });
  it("opens identity-only sign-in for the SDK's actual disconnected sentinel", async () => { setup(); mocks.getAccounts.mockResolvedValue([{ accountId: "", publicKey: "" }]); expect(await login()).toBe("alice.testnet"); expect(mocks.signIn).toHaveBeenCalledWith({}); });
  it("does not open a new connection if a valid cached account exists", async () => { setup(); mocks.getAccounts.mockResolvedValue([{ accountId: "alice.testnet" }]); expect(await login()).toBe("alice.testnet"); expect(mocks.signIn).not.toHaveBeenCalled(); });
  it("does not challenge or sign when the wallet returns no account after connection", async () => { setup(); mocks.signIn.mockResolvedValue([{ accountId: "" }]); await expect(login()).rejects.toThrow("Chưa chọn"); expect(mocks.api).not.toHaveBeenCalled(); expect(mocks.signMessage).not.toHaveBeenCalled(); });
});
