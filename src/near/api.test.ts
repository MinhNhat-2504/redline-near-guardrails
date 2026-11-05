import { afterEach, describe, expect, it, vi } from "vitest";
import { api, NearApiError, setToken } from "./api";
afterEach(() => { setToken(""); vi.unstubAllGlobals(); });
describe("onboarding session expiry and RPC uncertainty", () => {
  it("clears an expired bearer and exposes401 to restore the login controls", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher); setToken("ephemeral-test-session");
    await expect(api("/near/auth/me")).rejects.toMatchObject({ status: 401 });
    await api("/health");
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer ephemeral-test-session");
    expect(fetcher.mock.calls[1][1].headers.authorization).toBeUndefined();
    expect(new NearApiError(401).message).toContain("giữ nguyên request");
  });
  it("retains bearer on503 and never invents a successful response", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher); setToken("ephemeral-test-session");
    await expect(api("/near/grants/g")).rejects.toMatchObject({ status: 503 });
    await api("/health"); expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer ephemeral-test-session");
  });
  it("shows only whitelisted copilot diagnostic codes and retains login on provider failures", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ code: "PROVIDER_QUOTA", error: "secret-provider-message" }, { status: 503 })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher); setToken("ephemeral-test-session");
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ status: 503, code: "PROVIDER_QUOTA", message: expect.stringContaining("hạn mức") });
    await api("/health"); expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer ephemeral-test-session");
  });
  it.each(["untrusted-provider-secret", "constructor", "__proto__"])("never reflects unknown diagnostic %s", async code => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code, error: "secret-provider-message" }, { status: 503 })));
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ code: undefined, message: expect.not.stringContaining("secret") });
  });
  it("ignores diagnostic codes on financial routes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "RESPONSE_TRUNCATED" }, { status: 503 })));
    await expect(api("/near/grants/g/intents", {})).rejects.toMatchObject({ code: undefined, message: expect.stringContaining("Giữ nguyên request") });
  });
});
