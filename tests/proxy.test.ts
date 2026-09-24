// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const PASSWORD = "a-long-enough-admin-password";
const basic = (password: string) => `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
const request = (authorization?: string) =>
  new NextRequest("https://example.ch/admin", { headers: authorization ? { authorization } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("guards only the admin page and its API", () => {
    expect(config.matcher).toEqual(["/admin/:path*", "/api/admin/:path*"]);
  });
  it("asks for the password, and tells search engines to stay away", () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const response = proxy(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Basic realm="admin", charset="UTF-8"');
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("lets the right password through", () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const response = proxy(request(basic(PASSWORD)));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
  it("stays shut without a configured password", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(proxy(request(basic(""))).status).toBe(401);
  });
});
