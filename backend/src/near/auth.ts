import { createHash, randomBytes } from "node:crypto";
import { verifyMessage } from "near-api-js/nep413";
import { JsonRpcProvider, type PublicKey } from "near-api-js";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { accountId, httpError } from "./types.js";
import { NearReadOnlyRpc } from "./rpc.js";
import { u64 } from "./units.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const signedBody = z.object({
  challengeId: z.string().regex(/^[a-f0-9]{64}$/), state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  accountId, publicKey: z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
}).strict();

/** SDK's NEP-413 verifier calls viewAccessKey; always force finalized ownership. */
export class FinalAccessProvider extends JsonRpcProvider {
  private ready = false;
  private readonly reader: NearReadOnlyRpc;
  constructor(connection: { url: string }, reader?: NearReadOnlyRpc) {
    super(connection, { retries: 3, wait: 250, backoff: 2 });
    this.reader = reader ?? new NearReadOnlyRpc(connection.url);
  }
  override async viewAccessKey(args: Parameters<JsonRpcProvider["viewAccessKey"]>[0]) {
    if (!this.ready) { await this.reader.connect(); this.ready = true; }
    const result = z.object({ nonce: z.string(), block_hash: z.string(), block_height: z.number().int().nonnegative().safe(),
      permission: z.union([z.literal("FullAccess"), z.object({ FunctionCall: z.object({ receiver_id: z.string(), method_names: z.array(z.string()), allowance: z.string().nullable() }) })]),
    }).parse(await this.reader.accessKey(args.accountId, args.publicKey.toString()));
    return { ...result, nonce: u64(result.nonce) };
  }
}

export class NearAuth {
  constructor(
    private readonly db: PrismaClient,
    private readonly provider: JsonRpcProvider,
    private readonly recipient: string,
    private readonly callbackUrl: string,
    private readonly now: () => number = Date.now,
  ) {}

  async challenge(account: string, clientType: "wallet" | "cli" = "wallet") {
    accountId.parse(account);
    const id = randomBytes(32).toString("hex");
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64");
    const expiresAt = new Date(this.now() + 5 * 60_000);
    const callbackUrl = clientType === "cli" ? "" : this.callbackUrl;
    const message = ["REDLINE NEAR sign-in", `Account: ${account}`, "Network: testnet", `Client: ${clientType}`, `Recipient: ${this.recipient}`,
      `State: ${state}`, `Expires: ${expiresAt.toISOString()}`, "Sign-in only. This does not authorize a transfer."].join("\n");
    await this.db.nearChallenge.create({ data: { id, accountId: account, message, nonce, stateHash: hash(state), recipient: this.recipient, callbackUrl, expiresAt } });
    return { challengeId: id, state, accountId: account, message, recipient: this.recipient, nonce, callbackUrl: callbackUrl || undefined, clientType, expiresAt: expiresAt.toISOString() };
  }

  async verify(input: unknown) {
    const body = signedBody.parse(input);
    const challenge = await this.db.nearChallenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= this.now() || challenge.accountId !== body.accountId ||
        challenge.stateHash !== hash(body.state) || challenge.recipient !== this.recipient || (challenge.callbackUrl !== this.callbackUrl && challenge.callbackUrl !== "")) {
      throw httpError(401, "Invalid or expired NEAR challenge");
    }
    try {
      await verifyMessage({ signerAccountId: body.accountId, signerPublicKey: body.publicKey,
        signature: Buffer.from(body.signature, "base64"), provider: this.provider,
        payload: { message: challenge.message, nonce: Buffer.from(challenge.nonce, "base64"), recipient: challenge.recipient, callbackUrl: challenge.callbackUrl || undefined } });
    } catch { throw httpError(401, "NEAR signature or finalized key ownership could not be verified"); }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now() + 30 * 60_000);
    await this.db.$transaction(async tx => {
      const used = await tx.nearChallenge.updateMany({ where: { id: challenge.id, usedAt: null, expiresAt: { gt: new Date(this.now()) } }, data: { usedAt: new Date(this.now()) } });
      if (used.count !== 1) throw httpError(401, "NEAR challenge was already consumed");
      await tx.nearSession.create({ data: { tokenHash: hash(token), accountId: body.accountId, publicKey: body.publicKey, expiresAt } });
    });
    return { token, accountId: body.accountId, expiresAt: expiresAt.toISOString() };
  }

  async requireSession(authorization: unknown) {
    if (typeof authorization !== "string" || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) throw httpError(401, "NEAR wallet session required");
    const session = await this.db.nearSession.findUnique({ where: { tokenHash: hash(authorization.slice(7)) } });
    if (!session || session.expiresAt.getTime() <= this.now()) throw httpError(401, "NEAR session expired or invalid");
    try {
      const key = await this.provider.viewAccessKey({ accountId: session.accountId, publicKey: session.publicKey as string | PublicKey, finalityQuery: { finality: "final" } });
      if (key.permission !== "FullAccess") throw new Error("Key no longer authorized");
    } catch { throw httpError(401, "NEAR session key could not be verified on chain"); }
    return session;
  }

  async logout(authorization: string): Promise<void> {
    if (/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) await this.db.nearSession.deleteMany({ where: { tokenHash: hash(authorization.slice(7)) } });
  }
}
