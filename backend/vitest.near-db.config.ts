import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["test/near-postgres.integration.ts"], testTimeout: 20_000, hookTimeout: 20_000 } });
