import "./env.js";

if (process.env.CHAIN === "near") {
  const { startNearServer } = await import("./near/server-entry.js");
  await startNearServer();
} else {
  await import("./legacy-server.js");
}
