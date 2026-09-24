// @vitest-environment node
import { describe, expect, it } from "vitest";
import { adminAuthorized } from "@/admin-auth";

const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
const PASSWORD = "correct horse battery staple";

describe("adminAuthorized", () => {
  it("lets in the right password, whatever the user name", () => {
    expect(adminAuthorized(basic("admin", PASSWORD), PASSWORD)).toBe(true);
    expect(adminAuthorized(basic("koray", PASSWORD), PASSWORD)).toBe(true);
  });

  it("refuses a wrong or missing password, and a header that is not Basic", () => {
    expect(adminAuthorized(basic("admin", "wrong"), PASSWORD)).toBe(false);
    expect(adminAuthorized(basic("admin", ""), PASSWORD)).toBe(false);
    expect(adminAuthorized(null, PASSWORD)).toBe(false);
    expect(adminAuthorized(`Bearer ${PASSWORD}`, PASSWORD)).toBe(false);
    expect(adminAuthorized("Basic not-base64-%%%", PASSWORD)).toBe(false);
  });

  it("stays shut when no password is configured, or it is too short to be one", () => {
    expect(adminAuthorized(basic("admin", ""), undefined)).toBe(false);
    expect(adminAuthorized(basic("admin", ""), "")).toBe(false);
    expect(adminAuthorized(basic("admin", "short"), "short")).toBe(false);
  });
});
