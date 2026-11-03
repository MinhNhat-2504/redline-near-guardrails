// USER-RUN: asks the user's NEAR CLI to sign OFF-CHAIN, never reads wallet keys.
// Bearer token stays in ignored local state, never stdout or committed evidence.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { cliLoginProof } from "../src/near/cli-login.js";

async function main() {
  const api = "http://127.0.0.1:8787";
  const owner = "nhat-redline-owner.testnet";
  const binary = process.env.NEAR_CLI_PATH ?? (process.platform === "win32" ? join(process.env.APPDATA ?? "", "npm/node_modules/near-cli-rs/node_modules/.bin_real/near.exe") : "near");
  if (process.platform === "win32" && !existsSync(binary)) throw new Error("NEAR CLI binary not found; configure NEAR_CLI_PATH to the installed executable");
  if (process.argv[2] === "--check-cli") {
    const version = spawnSync(binary, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
    if (version.error || version.status !== 0) throw new Error("NEAR CLI version check failed");
    console.log(version.stdout.trim());
    console.log("CLI path check PASS. No challenge, signature, key read or financial action requested.");
    return;
  }
  if (process.argv.length > 2) throw new Error("Unsupported option; only --check-cli is available");
  const health = await (await fetch(api + "/health", { signal: AbortSignal.timeout(10_000) })).json();
  z.object({ chain: z.literal("near"), network: z.literal("testnet"), identityEnforced: z.literal(true), contractId: z.literal("nhat-redline-vault.testnet") }).parse(health);
  const response = await fetch(api + "/near/auth/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: owner, clientType: "cli" }), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Challenge HTTP ${response.status}: restart backend to load CLI-login support`);
  const challenge = z.object({ challengeId: z.string(), state: z.string(), accountId: z.literal(owner), message: z.string(), nonce: z.string(), recipient: z.literal("localhost:5173"), clientType: z.literal("cli"), callbackUrl: z.undefined().optional() }).parse(await response.json());
  console.log("OFF-CHAIN owner sign-in only. No grant, payment or transfer will be signed.");
  console.log(challenge.message);
  const args = ["message", "sign-nep413", "base64", Buffer.from(challenge.message).toString("base64"), "nonce", challenge.nonce, "recipient", challenge.recipient,
    "sign-as", owner, "sign-with-keychain", "network-config", "testnet"];
  const signed = spawnSync(binary, args, { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"], windowsHide: true, timeout: 120_000 });
  if (signed.error || signed.status !== 0) throw new Error("NEAR CLI sign-in did not complete; no transaction submitted");
  const proof = cliLoginProof(signed.stdout, challenge);
  const verified = await fetch(api + "/near/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(proof), signal: AbortSignal.timeout(60_000) });
  if (!verified.ok) throw new Error(`Sign-in verification HTTP ${verified.status}; retry with a fresh challenge`);
  const session = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), accountId: z.literal(owner), expiresAt: z.string() }).strict().parse(await verified.json());
  const me = await fetch(api + "/near/auth/me", { headers: { authorization: "Bearer " + session.token }, signal: AbortSignal.timeout(60_000) });
  if (!me.ok || (await me.json()).accountId !== owner) throw new Error("Session could not be revalidated; no financial action attempted");
  const directory = fileURLToPath(new URL("../../.tooling/near-local/", import.meta.url));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "session.json"), JSON.stringify(session, null, 2), { mode: 0o600 });
  const report = { status: "AUTHENTICATED", accountId: owner, publicKey: proof.publicKey, challengeId: challenge.challengeId, clientType: "cli", expiresAt: session.expiresAt,
    verification: "API NEP-413 verify and authenticated /me both succeeded", token: "NOT INCLUDED", financialActions: "NONE" };
  await writeFile(new URL("../../docs/evidence/phase3-owner-cli-login.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(`AUTHENTICATED: ${owner}`);
  console.log(`Expires: ${session.expiresAt}`);
  console.log("Session saved locally. Do not share session.json. No funds moved.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Owner sign-in failed"); process.exitCode = 1; });
