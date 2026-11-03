import { baseDecode } from "near-api-js";
import { z } from "zod";
import { accountId } from "./types.js";

/** near-cli-rs 0.30.1 emits an ed25519:base58 signature, not NEP-413 base64. */
export function cliLoginProof(stdout: string, challenge: { challengeId: string; state: string; accountId: string }) {
  const signed = z.object({ accountId, publicKey: z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/), signature: z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/) }).strict().parse(JSON.parse(stdout));
  if (signed.accountId !== challenge.accountId) throw new Error("CLI signed for a different account");
  const signature = baseDecode(signed.signature.slice("ed25519:".length));
  if (signature.length !== 64) throw new Error("CLI returned an invalid Ed25519 signature length");
  return { challengeId: challenge.challengeId, state: challenge.state, accountId: signed.accountId, publicKey: signed.publicKey, signature: Buffer.from(signature).toString("base64") };
}
