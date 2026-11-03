import "../env.js";
import { PrismaClient } from "@prisma/client";
import { NearChain } from "../chain/near.js";
import { NearAuth, FinalAccessProvider } from "./auth.js";
import { NearReadOnlyRpc } from "./rpc.js";
import { NearRpcError } from "./rpc.js";
import { nearConfig } from "./config.js";
import { buildNearApp } from "./server.js";
import { NearIndexer } from "./indexer.js";

export async function startNearServer() {
  const config = nearConfig();
  const db = new PrismaClient();
  const provider = new FinalAccessProvider({ url: config.rpcUrl });
  const chain = new NearChain(config, new NearReadOnlyRpc(config.rpcUrl), provider, db);
  try {
    await db.$connect();
    await db.nearWatermark.count(); // fail clearly before listening if migration was not applied
    await chain.connect();
    const app = await buildNearApp(chain, new NearAuth(db, provider, config.recipient, config.callbackUrl), config.origin);
    const indexer = new NearIndexer(chain, config.startBlock);
    let stopping = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: Promise<void> | undefined;
    const tick = async () => {
      try { await indexer.reconcileJournal(); await indexer.scan(1); }
      catch (error) { app.log.warn({ reason: error instanceof NearRpcError ? error.code : "RECONCILIATION_ERROR", rpcCause: error instanceof NearRpcError ? error.remoteName : undefined }, "NEAR reconciliation incomplete; retaining checkpoint and all reservations"); }
      if (!stopping) timer = setTimeout(() => { running = tick(); }, 30_000);
    };
    app.addHook("onClose", async () => { stopping = true; if (timer) clearTimeout(timer); await running; await db.$disconnect(); });
    await app.listen({ port: config.port, host: "127.0.0.1" });
    running = tick();
    return app;
  } catch { await db.$disconnect(); throw new Error("NEAR startup failed: verify configuration, additive migration and scoped executor permission locally"); }
}
