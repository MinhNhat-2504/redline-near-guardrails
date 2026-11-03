import { afterEach, expect, it, vi } from "vitest";
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet";
import { Buffer } from "buffer";

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("pinned Intear adapter sends Testnet identity-only connect and the exact NEP-413 callback (synthetic DOM, no real wallet)", async () => {
  vi.useFakeTimers();
  const saved = new Map<string, string>();
  const listeners = new Set<(event: any) => unknown>();
  const iframePost = vi.fn(), popupPost = vi.fn();
  const popup = { postMessage: popupPost, close: vi.fn(), closed: false };
  const iframe = { style: {}, src: "", contentWindow: { postMessage: iframePost }, remove: vi.fn() };
  const fakeWindow = {
    localStorage: { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v) },
    addEventListener: (type: string, fn: (e: any) => unknown) => { if (type === "message") listeners.add(fn); },
    removeEventListener: (_type: string, fn: (e: any) => unknown) => listeners.delete(fn), open: vi.fn(() => popup),
  };
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("location", { origin: "http://localhost:5173" });
  vi.stubGlobal("document", { createElement: () => iframe, body: { appendChild: vi.fn() } });
  vi.stubGlobal("WebSocket", class { close() {} });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Unexpected external request in synthetic transport test"); }));
  const module = await setupIntearWallet({ walletUrl: "https://wallet.intear.tech" })({} as any);
  expect(module).not.toBeNull();
  const wallet = await module!.init({ options: { network: { networkId: "testnet", nodeUrl: "https://test.rpc.fastnear.com" } }, logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }, metadata: module!.metadata } as any);
  const dispatch = async (data: unknown) => { for (const listener of [...listeners]) await listener({ data, origin: "https://wallet.intear.tech" }); };
  const connected = wallet.signIn({});
  await dispatch({ type: "ready" });
  const connect = iframePost.mock.calls[0];
  expect(connect[1]).toBe("https://wallet.intear.tech");
  expect(connect[0].data.networkId).toBe("testnet");
  expect(connect[0].data.contractId).toBeUndefined();
  expect(connect[0].data.methodNames).toBeUndefined();
  const publicKey = "ed25519:9hauPZp4YBAHNMNp8bf4ThyYuSMeVTrKn5twEU2JrCy3";
  await dispatch({ type: "connected", accounts: [{ accountId: "alice.testnet", publicKey }], functionCallKeyAdded: false, logoutKey: publicKey, walletUrl: "https://wallet.intear.tech", useBridge: false });
  await connected; await dispatch({ type: "close" });
  const args = { message: "Synthetic sign-in only", nonce: Buffer.alloc(32, 7), recipient: "localhost:5173", callbackUrl: "http://localhost:5173/near/auth/callback", state: "synthetic-state" };
  if (!wallet.signMessage) throw Error("Pinned adapter must support signMessage");
  const signed = wallet.signMessage(args);
  await dispatch({ type: "ready" });
  const sent = popupPost.mock.calls[0];
  expect(sent[1]).toBe("https://wallet.intear.tech");
  const payload = JSON.parse(sent[0].data.message);
  expect(payload).toEqual({ ...args, nonce: [...args.nonce] });
  // Invalid dummy signature exercises transport formatting only; never called a proof.
  await dispatch({ type: "signed", signature: { accountId: "alice.testnet", publicKey, signature: "ed25519:" + "1".repeat(64) } });
  expect((await signed)?.signature).toBe(Buffer.alloc(64).toString("base64"));
  expect(fetch).not.toHaveBeenCalled();
});
