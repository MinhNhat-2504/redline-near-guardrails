import { Buffer } from "buffer";

/** Wallet Selector uses unqualified Buffer even when our own code imports it. */
export function ensureBrowserBuffer(): void {
  if (typeof globalThis.Buffer === "undefined") {
    Object.defineProperty(globalThis, "Buffer", { value: Buffer, writable: true, configurable: true });
  }
}

// Side effect runs when the NEAR wallet module loads, before any SDK calls.
ensureBrowserBuffer();
