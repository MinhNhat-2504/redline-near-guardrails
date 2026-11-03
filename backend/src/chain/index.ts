import type { ChainAdapter } from "./adapter.js";
import { MockChain } from "./mock.js";
import { SolanaChain } from "./solana.js";

let instance: ChainAdapter | null = null;

// Call once at startup (server.ts) so route handlers can use getChain() sync.
export async function initChain(): Promise<ChainAdapter> {
  const kind = process.env.CHAIN ?? "mock";
  if (kind !== "mock" && kind !== "solana") {
    throw new Error(kind === "near"
      ? "CHAIN=near is not enabled: NEAR owner authentication, executor signing and API integration are pending; read-only NEAR modules do not authorize writes"
      : `Unsupported CHAIN configuration: ${kind}`);
  }
  if (instance) {
    if (instance.kind !== kind) throw new Error("CHAIN changed after startup; restart with the intended configuration");
    return instance;
  }
  if (kind === "solana") {
    const programId = process.env.REDLINE_PROGRAM_ID;
    const executorKeypairPath = process.env.EXECUTOR_KEYPAIR_PATH;
    if (!programId || !executorKeypairPath) throw new Error("CHAIN=solana needs REDLINE_PROGRAM_ID and EXECUTOR_KEYPAIR_PATH");
    instance = await SolanaChain.create({
      rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      wsUrl: process.env.SOLANA_WS_URL ?? "wss://api.devnet.solana.com",
      programId,
      executorKeypairPath,
      ownerKeypairPath: process.env.DEMO_OWNER_KEYPAIR_PATH,
    });
  } else {
    instance = new MockChain();
  }
  return instance;
}

export function getChain(): ChainAdapter {
  if (!instance) throw new Error("chain not initialised: call initChain() first");
  return instance;
}
