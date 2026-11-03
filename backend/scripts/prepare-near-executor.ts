// USER-RUN only. Generates a NEW scoped-key candidate locally; never accesses OS keychain.
// Does not install permissions, call RPC, sign an owner transaction or broadcast.
import { KeyPair } from "near-api-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function prepareExecutor(directory: string) {
  await mkdir(directory, { recursive: true });
  const credentialPath = resolve(directory, "executor.json");
  const metadataPath = resolve(directory, "public.json");
  try { return JSON.parse(await readFile(metadataPath, "utf8")) as { accountId: string; publicKey: string; credentialPath: string }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Executor metadata unavailable; do not overwrite existing keys"); }
  const key = KeyPair.fromRandom("ed25519");
  const metadata = { accountId: "nhat-redline-agent.testnet", publicKey: key.getPublicKey().toString(), credentialPath };
  await writeFile(credentialPath, JSON.stringify({ account_id: metadata.accountId, public_key: metadata.publicKey, private_key: key.toString() }, null, 2), { flag: "wx", mode: 0o600 });
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), { flag: "wx", mode: 0o600 });
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../../.tooling/near-executor");
  const metadata = await prepareExecutor(directory);
  console.log("LOCAL key candidate prepared. NOT installed; no RPC or transaction submitted. Keep executor.json private.");
  console.log(`Public key: ${metadata.publicKey}`);
  console.log(`Account: ${metadata.accountId}`);
  console.log("Allowed contract: nhat-redline-vault.testnet; method: execute_transfer; gas allowance: 0.1 NEAR; deposit: 0.");
  console.log(`near account add-key ${metadata.accountId} grant-function-call-access --allowance '0.1 NEAR' --contract-account-id nhat-redline-vault.testnet --function-names execute_transfer use-manually-provided-public-key ${metadata.publicKey} network-config testnet sign-with-keychain send`);
}
