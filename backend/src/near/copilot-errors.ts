export type CopilotCode = "SNAPSHOT_UNAVAILABLE" | "PROVIDER_KEY_REJECTED" | "PROVIDER_ACCESS_DENIED" | "PROVIDER_MODEL_UNAVAILABLE" | "PROVIDER_QUOTA" | "PROVIDER_REQUEST_REJECTED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "RESPONSE_TRUNCATED" | "RESPONSE_BLOCKED" | "INVALID_RESPONSE" | "PROVIDER_CONFIG_INVALID" | "PROVIDER_NETWORK_ERROR" | "PROVIDER_DNS_ERROR" | "PROVIDER_TLS_ERROR" | "PROVIDER_CONNECTION_RESET" | "PROVIDER_HTTP_500" | "PROVIDER_HTTP_502" | "PROVIDER_HTTP_503" | "PROVIDER_HTTP_504" | "PROVIDER_COOLDOWN";
export class CopilotError extends Error {
  readonly statusCode = 503;
  constructor(readonly code: CopilotCode, readonly retryAfterSeconds?: number) { super("Copilot response unavailable or invalid; no authorization or settlement inferred"); }
}
/** Classify known platform codes only; never copy messages, URLs, headers or causes into a response. */
export function providerTransportError(error: unknown, aborted = false): CopilotError {
  const e = error as { name?: string; code?: string; cause?: { code?: string; errors?: { code?: string }[] } } | undefined;
  const codes = [e?.code, e?.cause?.code, ...(Array.isArray(e?.cause?.errors) ? e.cause.errors.map(x => x?.code) : [])];
  if (aborted || e?.name === "AbortError" || e?.name === "TimeoutError" || codes.some(c => ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(c ?? ""))) return new CopilotError("PROVIDER_TIMEOUT");
  if (codes.some(c => ["ENOTFOUND", "EAI_AGAIN"].includes(c ?? ""))) return new CopilotError("PROVIDER_DNS_ERROR");
  if (codes.some(c => ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"].includes(c ?? ""))) return new CopilotError("PROVIDER_TLS_ERROR");
  if (codes.some(c => ["ECONNRESET", "ECONNREFUSED", "UND_ERR_SOCKET"].includes(c ?? ""))) return new CopilotError("PROVIDER_CONNECTION_RESET");
  return new CopilotError("PROVIDER_NETWORK_ERROR");
}
