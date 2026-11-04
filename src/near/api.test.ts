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
});
