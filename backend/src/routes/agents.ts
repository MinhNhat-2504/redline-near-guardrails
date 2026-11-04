import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { audit } from "../db/audit.js";
import { callerWallet, identityEnforced, requireSession } from "../auth.js";
import { json } from "./json.js";
import { ratingsForListings, ratingsForVersions } from "./ratings.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// Deterministic JSON: object keys sorted at every depth, so the same config
// always hashes the same. `JSON.stringify(value, sortedTopLevelKeys)` looked
// like this but is not — a replacer *array* is a whitelist applied at every
// level, so nested keys absent from the top level were dropped and
// `{a:{b:1}}` and `{a:{b:2}}` both hashed as `{"a":{}}`.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

// Immutable agent builds. agentHash binds model + code + config; a change to
// any of them is a new row, never an update.
//
// A build is owned by the wallet that published it. That ownership is taken
// from the caller's signed session — never from the request body — because a
// body field naming a wallet proves nothing about who is calling, and the
// publisher is who gets paid when the agent is rented.
export async function agentRoutes(app: FastifyInstance) {
  app.post("/agents", async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(80),
      version: z.string().min(1).max(20),
      strategy: z.string().min(1).max(200),
      modelRef: z.string().min(1).max(120),   // e.g. "openai:gpt-5.4-mini" or a weights CID
      codeRef: z.string().min(1).max(120),    // e.g. git commit of the runtime
      config: z.record(z.string(), z.unknown()).default({}),
    }).parse(req.body);

    // Publishing puts something on a marketplace under a name that will be
    // paid. Doing that anonymously is meaningless, so a public deployment
    // demands a signature; local/mock keeps publishing open for demo.sh and
    // records the row as unclaimed.
    const publisherWallet = requireSession(req);

    const modelHash = sha(body.modelRef);
    const codeHash = sha(body.codeRef);
    const configHash = sha(canonicalJson(body.config));
    const agentHash = sha(`${modelHash}|${codeHash}|${configHash}`);

    // Re-publishing the identical build from the same wallet is idempotent —
    // it returns the row that already exists rather than creating a twin.
    // Postgres treats NULLs as distinct in a unique index, so the unclaimed
    // case has to be matched by hand or every anonymous demo run would pile up
    // another row for the same build.
    const existing = publisherWallet
      ? await prisma.agentVersion.findUnique({ where: { agentHash_publisherWallet: { agentHash, publisherWallet } } })
      : await prisma.agentVersion.findFirst({ where: { agentHash, publisherWallet: null } });

    const agent = existing ?? await prisma.agentVersion.create({
      data: { name: body.name, version: body.version, strategy: body.strategy, modelHash, codeHash, configHash, agentHash, publisherWallet },
    });

    // Each build gets one default listing. Keyed off the agent row id, so two
    // publishers of the same bytes get separate listings they each control.
    const listing = await prisma.agentListing.upsert({
      where: { id: `${agent.id}-default` },
      update: {},
      create: { id: `${agent.id}-default`, agentVersionId: agent.id },
    });

    if (!existing) {
      await audit({
        actorType: "owner", actorId: publisherWallet ?? "anonymous", eventType: "agent.published",
        subjectType: "agent", subjectId: agent.id,
        payload: { agentHash, name: agent.name, version: agent.version, listingId: listing.id, publisherWallet },
      });
    }
    return reply.code(existing ? 200 : 201).send(json({ agent, listing }));
  });

  // The catalogue. `mine=true` narrows it to the caller's own builds, which is
  // the question the Agents page actually asks — "which of these are mine?" —
  // and which the old unscoped list could not answer at all.
  //
  // `publisherWallet` is returned on every row so the UI can label someone
  // else's agent as theirs instead of implying every listed build belongs to
  // whoever is looking.
  app.get("/agents", async (req) => {
    const { mine, publisher } = req.query as { mine?: string; publisher?: string };
    const caller = callerWallet(req);
    let where: { publisherWallet?: string | null } | undefined;
    if (mine === "true") {
      // Asking for "mine" without a session is an empty set, not everyone's.
      if (!caller) return json([]);
      where = { publisherWallet: caller };
    } else if (publisher) {
      where = { publisherWallet: publisher };
    }
    const agents = await prisma.agentVersion.findMany({ where, include: { listings: true }, orderBy: { createdAt: "desc" } });
    const ratings = await ratingsForVersions(agents.map(a => a.id));
    return json(agents.map(a => ({
      ...a,
      isMine: Boolean(caller && a.publisherWallet === caller),
      unclaimed: a.publisherWallet === null,
      rating: ratings.get(a.id) ?? null,
    })));
  });

  // One build, with its reputation attached. Public: the whole point of a
  // marketplace is that a stranger can judge an agent before renting it.
  app.get("/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await prisma.agentVersion.findUnique({ where: { id }, include: { listings: true } });
    if (!agent) return reply.code(404).send({ error: "agent not found" });
    const caller = callerWallet(req);
    const [versionRatings, listingRatings] = await Promise.all([
      ratingsForVersions([agent.id]),
      ratingsForListings(agent.listings.map(l => l.id)),
    ]);
    return json({
      ...agent,
      isMine: Boolean(caller && agent.publisherWallet === caller),
      unclaimed: agent.publisherWallet === null,
      identityEnforced: identityEnforced(),
      rating: versionRatings.get(agent.id) ?? null,
      listings: agent.listings.map(l => ({ ...l, rating: listingRatings.get(l.id) ?? null })),
    });
  });
}
