import { afterEach, describe, expect, it, vi } from "vitest";
import { api, confirmSession, NearApiError, setToken } from "./api";
afterEach(() => { setToken(""); vi.unstubAllGlobals(); });
describe("onboarding session expiry and RPC uncertainty", () => {
  it("explains local copilot rate limit without suggesting another login or leaking body", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "private-error" }, { status: 429 })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher); setToken("ephemeral-test-session");
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ code: "COPILOT_REQUEST_LIMIT", retryAfterSeconds: 60, message: expect.not.stringContaining("private-error") });
    await api("/health"); expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer ephemeral-test-session");
  });
  it.each(["PROVIDER_CONFIG_INVALID", "PROVIDER_NETWORK_ERROR", "PROVIDER_DNS_ERROR", "PROVIDER_TLS_ERROR", "PROVIDER_CONNECTION_RESET", "PROVIDER_HTTP_500", "PROVIDER_HTTP_502", "PROVIDER_HTTP_503", "PROVIDER_HTTP_504"])("displays safe connection diagnostic %s", async code => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code, error: "private-provider-error" }, { status: 503 })));
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ code, message: expect.stringContaining(code) });
    await expect(api("/near/copilot/explain", {})).rejects.toThrow(expect.not.stringContaining("private-provider-error"));
  });
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
  it("retains a bounded retry hint without leaking the provider body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "PROVIDER_HTTP_503", retryAfterSeconds: 60, error: "private-provider-error" }, { status: 503 })));
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ code: "PROVIDER_HTTP_503", retryAfterSeconds: 60, message: expect.not.stringContaining("private-provider-error") });
  });
  it.each([-1, 0, 301, 1.5, "60"])("ignores untrusted retry duration %#", async retryAfterSeconds => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "PROVIDER_COOLDOWN", retryAfterSeconds }, { status: 503 })));
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ code: "PROVIDER_COOLDOWN", retryAfterSeconds: undefined });
  });
  it.each(["untrusted-provider-secret", "constructor", "__proto__"])("never reflects unknown diagnostic %s", async code => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code, error: "secret-provider-message" }, { status: 503 })));
    await expect(api("/near/copilot/explain", {})).rejects.toMatchObject({ code: undefined, message: expect.not.stringContaining("secret") });
  });
  it("ignores diagnostic codes on financial routes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "RESPONSE_TRUNCATED" }, { status: 503 })));
    await expect(api("/near/grants/g/intents", {})).rejects.toMatchObject({ code: undefined, message: expect.stringContaining("Giữ nguyên request") });
  });
  it("sends the newly verified token through the same client before claiming authenticated UI", async () => {
    const fetcher = vi.fn(async (_url: unknown, _options?: RequestInit) => Response.json({ accountId: "owner.testnet", expiresAt: new Date(Date.now() + 60000).toISOString() }));
    vi.stubGlobal("fetch", fetcher); setToken("synthetic-test-session"); await confirmSession("owner.testnet");
    expect(fetcher.mock.calls[0][0]).toContain("/near/auth/me"); expect((fetcher.mock.calls[0] as any)[1].headers.authorization).toBe("Bearer synthetic-test-session");
  });
  it("detects missing local bearer before any protected request or fake logged-in UI", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); setToken("");
    await expect(confirmSession("owner.testnet")).rejects.toThrow("chưa nhận được phiên"); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{ accountId: "other.testnet", expiresAt: "2999-01-01T00:00:00Z" }, { accountId: "owner.testnet", expiresAt: "2000-01-01T00:00:00Z" }, { accountId: "owner.testnet", expiresAt: "bad" }])("rejects wrong identity or expiry from session handshake %#", async response => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(response)).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher); setToken("synthetic-test-session"); await expect(confirmSession("owner.testnet")).rejects.toThrow("API chưa xác nhận");
    await api("/health"); expect(fetcher.mock.calls[1][1].headers.authorization).toBeUndefined();
  });
  it("does not clear a newer login when an older request receives401 late", async () => {
    let finish!: (r: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher); setToken("old-synthetic-session");
    const pending = api("/near/copilot/explain", {}); setToken("new-synthetic-session"); finish(new Response("", { status: 401 }));
    await expect(pending).rejects.toMatchObject({ status: 401, staleSession: true }); await api("/health"); expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer new-synthetic-session");
  });
});
