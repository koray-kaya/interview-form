import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  touch: vi.fn(async () => {}),
  deleteUnfinishedBefore: vi.fn(async () => 2),
  readAll: vi.fn(async () => ({ responses: [{ id: "r1" }], answers: [], probe_calls: [] })),
}));
vi.mock("@vercel/blob", () => ({ put: vi.fn(async () => ({ pathname: "exports/x.json" })) }));
import * as db from "@/db";
import { put } from "@vercel/blob";
import { GET } from "@/app/api/cron/daily/route";

// A made-up key, assembled at runtime so secret scanners do not mistake it for a real one.
const FAKE_SECRET_KEY = ["sb", "secret", "test".repeat(4)].join("_");

const SECRET = "s".repeat(40);

async function run(authorization?: string) {
  return GET(new Request("http://localhost/api/cron/daily", { headers: authorization ? { authorization } : {} }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", FAKE_SECRET_KEY);
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("GET /api/cron/daily", () => {
  it("refuses a missing or wrong secret", async () => {
    expect((await run()).status).toBe(401);
    expect((await run("Bearer wrong")).status).toBe(401);
    expect((await run(SECRET)).status).toBe(401);
    expect(db.touch).not.toHaveBeenCalled();
  });

  it("keeps the project awake and deletes what was left unfinished for more than seven days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z"));
    const response = await run(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 2, exported: 0 });
    expect(db.touch).toHaveBeenCalledOnce();
    // an 8-day-old unfinished response (created 2026-10-02) lies before the cutoff, a 6-day-old one does not
    const cutoff = vi.mocked(db.deleteUnfinishedBefore).mock.calls[0][0];
    expect(cutoff.toISOString()).toBe("2026-10-03T03:00:00.000Z");
  });

  it("writes a private export to Blob when a token is configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_token");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z"));
    const response = await run(`Bearer ${SECRET}`);
    expect(await response.json()).toEqual({ deleted: 2, exported: 1 });
    const [pathname, body, options] = vi.mocked(put).mock.calls[0];
    expect(pathname).toBe("exports/2026-10-10.json");
    expect(JSON.parse(body as string).responses).toEqual([{ id: "r1" }]);
    expect(options).toMatchObject({ access: "private", allowOverwrite: true, token: "vercel_blob_rw_token" });
  });
});
