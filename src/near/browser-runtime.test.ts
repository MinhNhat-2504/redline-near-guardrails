import { afterEach, expect, it, vi } from "vitest";
import { Buffer as BrowserBuffer } from "buffer";
import { serializeNep413 } from "@near-wallet-selector/core";
import { ensureBrowserBuffer } from "./browser-runtime";

afterEach(() => vi.unstubAllGlobals());

it("reproduces missing browser Buffer in the real SDK, then serializes callback-bound NEP-413 after bootstrap", () => {
  const args = { message: "Synthetic sign-in", nonce: BrowserBuffer.alloc(32, 7), recipient: "localhost:5173", callbackUrl: "http://localhost:5173/near/auth/callback" };
  vi.stubGlobal("Buffer", undefined);
  expect(() => serializeNep413(args)).toThrow();
  ensureBrowserBuffer();
  const serialized = serializeNep413(args);
  expect(BrowserBuffer.isBuffer(serialized)).toBe(true);
  expect(serialized.readUInt32LE(0)).toBe(2147484061);
  expect(serialized.includes(BrowserBuffer.from(args.callbackUrl))).toBe(true);
  expect(serialized.includes(BrowserBuffer.from(args.recipient))).toBe(true);
  expect(serialized.equals(serializeNep413({ ...args, callbackUrl: undefined }))).toBe(false);
});

it("preserves an existing Buffer implementation and is safe to call repeatedly", () => {
  const existing = globalThis.Buffer;
  ensureBrowserBuffer(); ensureBrowserBuffer();
  expect(globalThis.Buffer).toBe(existing);
});
