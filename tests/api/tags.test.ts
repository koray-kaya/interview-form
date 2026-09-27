// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TagSource } from "@/tags";

// The database is mocked: these tests check what the route lets out, not
// Supabase. A row from Supabase carries more columns than TagSource names
// (id, lang, …); the extra fields here prove the route drops them rather
// than passing them through (Minor 4, #24). Typed loosely enough to compile:
// cast the mock return.
vi.mock("@/db", () => ({
  readTagSources: vi.fn(
    async () =>
      [
        {
          company_uid: "P-7K3Q9X",
          created_at: "2026-10-03T10:00:00+00:00",
          completed_at: null,
          id: "3f1c2b7a-1111-4aaa-9bbb-000000000001",
          lang: "de",
        },
        { company_uid: "SMOKE", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
      ] as unknown as TagSource[],
  ),
}));
import * as db from "@/db";
import { GET } from "@/app/api/admin/tags/route";

const PASSWORD = "correct horse battery staple";
const basic = (password: string) => `Basic ${Buffer.from(`company-reach:${password}`).toString("base64")}`;

function get(authorization?: string) {
  return GET(
    new Request("http://localhost/api/admin/tags", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/admin/tags", () => {
  it("gives the admin each tag with its times", async () => {
    const response = await get(basic(PASSWORD));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tags: [{ tag: "P-7K3Q9X", started_at: "2026-10-03T10:00:00+00:00", completed_at: null }],
    });
  });

  it("marks the response no-store itself, not only through the Proxy (Minor 5)", async () => {
    const response = await get(basic(PASSWORD));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses without the right password, and reads nothing", async () => {
    for (const authorization of [undefined, basic("wrong password here")]) {
      expect((await get(authorization)).status).toBe(401);
    }
    expect(db.readTagSources).not.toHaveBeenCalled();
  });

  it("stays shut while no password of twelve characters is set", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect((await get(basic("short"))).status).toBe(401);
    expect(db.readTagSources).not.toHaveBeenCalled();
  });
});
