export type CopilotCode = "SNAPSHOT_UNAVAILABLE" | "PROVIDER_KEY_REJECTED" | "PROVIDER_ACCESS_DENIED" | "PROVIDER_MODEL_UNAVAILABLE" | "PROVIDER_QUOTA" | "PROVIDER_REQUEST_REJECTED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "RESPONSE_TRUNCATED" | "RESPONSE_BLOCKED" | "INVALID_RESPONSE";
export class CopilotError extends Error {
  readonly statusCode = 503;
  constructor(readonly code: CopilotCode) { super("Copilot response unavailable or invalid; no authorization or settlement inferred"); }
}
