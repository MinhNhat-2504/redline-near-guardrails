import { z } from "zod";
import { accountId } from "./types.js";
import { DEFAULT_NEAR_RPC } from "./rpc.js";

export function nearConfig(env: NodeJS.ProcessEnv = process.env) {
  const origin = new URL(z.string().url().parse(env.NEAR_APP_ORIGIN));
  if (origin.origin !== env.NEAR_APP_ORIGIN || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new Error("NEAR_APP_ORIGIN must be an exact HTTPS origin (localhost HTTP allowed)");
  }
  const rpcUrl = env.NEAR_RPC_URL ?? DEFAULT_NEAR_RPC;
  const rpc = new URL(rpcUrl);
  if (rpc.protocol !== "https:" || rpc.username || rpc.password) throw new Error("Invalid HTTPS NEAR RPC URL");
  if ((env.NEAR_NETWORK ?? "testnet") !== "testnet") throw new Error("Only NEAR Testnet is supported");
  const contractId = accountId.parse(env.NEAR_CONTRACT_ID ?? "nhat-redline-vault.testnet");
  const start = env.NEAR_START_BLOCK ?? (contractId === "nhat-redline-vault.testnet" ? "275991840" : "");
  if (!/^(0|[1-9][0-9]*)$/.test(start) || !Number.isSafeInteger(Number(start))) throw new Error("NEAR_START_BLOCK required for this contract");
  const port = Number(env.PORT ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  return { origin: origin.origin, recipient: origin.host, callbackUrl: origin.origin + "/near/auth/callback",
    rpcUrl, contractId, executorId: accountId.parse(env.NEAR_EXECUTOR_ID ?? "nhat-redline-agent.testnet"),
    executorPublicKey: env.NEAR_EXECUTOR_PUBLIC_KEY, credentialPath: env.NEAR_EXECUTOR_CREDENTIAL_PATH,
    startBlock: Number(start), port };
}
