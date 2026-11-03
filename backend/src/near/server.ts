import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { NearAuth } from "./auth.js";
import { accountId, hashId, httpError, recordId, transferSchema } from "./types.js";
import { prepareOwnerAction } from "./owner-actions.js";
import type { NearChain } from "../chain/near.js";

export async function buildNearApp(chain: NearChain, auth: NearAuth, origin: string, logging = true) {
  const app = Fastify({ bodyLimit: 32_768, logger: logging ? { redact: ["req.headers.authorization", "req.headers.cookie"] } : false });
  await app.register(cors, { origin, methods: ["GET", "POST"], allowedHeaders: ["content-type", "authorization"] });
  await app.register(rateLimit, { max: 90, timeWindow: "1 minute" });
  app.addHook("onRequest", async req => {
    if (req.headers.origin && req.headers.origin !== origin) throw httpError(403, "Unexpected NEAR application origin");
    if (req.method === "POST" && !req.headers["content-type"]?.startsWith("application/json")) throw httpError(415, "JSON content type required");
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: "Invalid NEAR request or chain data" });
    const status = error.statusCode ?? 503;
    // Never reflect raw SDK, credential-file, Prisma or RPC errors.
    return reply.code(status).send({ error: error.statusCode ? error.message : "NEAR operation unavailable; no settlement inferred" });
  });
  const session = (req: FastifyRequest) => auth.requireSession(req.headers.authorization);
  app.get("/health", async () => ({ ok: true, chain: "near", network: "testnet", contractId: chain.config.contractId, executorId: chain.config.executorId, identityEnforced: true, signingEnabled: chain.signingEnabled }));
  app.post("/near/auth/challenge", async req => auth.challenge(z.object({ accountId }).strict().parse(req.body).accountId));
  app.post("/near/auth/verify", async req => auth.verify(req.body));
  app.post("/near/auth/logout", async req => { await auth.logout(req.headers.authorization ?? ""); return { ok: true }; });
  app.get("/near/auth/me", async req => { const s = await session(req); return { accountId: s.accountId, expiresAt: s.expiresAt.toISOString() }; });
  app.get("/near/grants/:id", async req => {
    const { id } = z.object({ id: recordId }).parse(req.params);
    const grant = await chain.readGrant(id);
    if (!grant) throw httpError(404, "NEAR grant not found");
    return grant;
  });
  app.get("/near/owners/:account/balance", async req => chain.readBalance(z.object({ account: accountId }).parse(req.params).account));
  app.post("/near/owner-actions", async req => prepareOwnerAction(chain, (await session(req)).accountId, req.body));
  app.post("/near/grants/:id/intents", async req => {
    const owner = (await session(req)).accountId;
    const { id } = z.object({ id: recordId }).parse(req.params);
    const args = transferSchema.parse(req.body);
    if (id !== args.grant_id) throw httpError(400, "Grant ID mismatch");
    return chain.executeTransfer(owner, args);
  });
  app.post("/near/transactions/track", async req => {
    const owner = (await session(req)).accountId;
    const body = z.object({ hash: hashId, signerId: accountId }).strict().parse(req.body);
    if (body.signerId !== owner && body.signerId !== chain.config.executorId) throw httpError(403, "Unexpected transaction signer");
    // Tracking changes no financial state; finalized public events remain source of truth.
    return chain.track(body.hash, body.signerId);
  });
  app.get("/near/transactions", async req => {
    const owner = (await session(req)).accountId;
    const { grantId } = z.object({ grantId: recordId }).strict().parse(req.query);
    const grant = await chain.readGrant(grantId);
    if (!grant || grant.value.owner !== owner) throw httpError(403, "Only the grant owner can read this journal");
    return chain.db.nearTransaction.findMany({ where: { scope: chain.store.scope, grantId }, orderBy: { createdAt: "desc" }, take: 100,
      select: { hash: true, signerId: true, grantId: true, intentId: true, state: true, reason: true, observation: true, createdAt: true } });
  });
  return app;
}
