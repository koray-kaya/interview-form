// @vitest-environment node
// Supabase returns at most 1000 rows per request, without an error, so one
// select can come back cut off (#25). readAll and readStats page through
// every row and throw rather than return a short list. The client is faked:
// each table has a size, and a range returns the rows inside it.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ sizes: {} as Record<string, number>, short: "", ranges: [] as string[] }));

vi.mock("@/env", () => ({
  serverEnv: () => ({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        order: () => query,
        range: async (from: number, to: number) => {
          fake.ranges.push(`${table} ${from}-${to}`);
          const total = fake.sizes[table] ?? 0;
          const last = Math.min(to, total - 1);
          let data = Array.from({ length: Math.max(0, last - from + 1) }, (_, i) => ({ id: from + i }));
          if (table === fake.short) data = data.slice(1);
          return { data, error: null, count: total };
        },
      };
      return query;
    },
  }),
}));
import { readAll, readStats } from "@/db";

beforeEach(() => {
  fake.sizes = {};
  fake.short = "";
  fake.ranges = [];
});

describe("readAll", () => {
  it("reads every row past the 1000-row cap, page by page", async () => {
    fake.sizes = { responses: 3, answers: 2500, probe_calls: 1000 };
    const all = await readAll();
    expect(all.responses).toHaveLength(3);
    expect(all.answers).toHaveLength(2500);
    expect(all.answers.at(-1)).toEqual({ id: 2499 });
    expect(all.probe_calls).toHaveLength(1000);
    expect(fake.ranges.filter((r) => r.startsWith("answers"))).toEqual([
      "answers 0-999",
      "answers 1000-1999",
      "answers 2000-2999",
    ]);
  });

  it("throws instead of returning a cut-off list", async () => {
    fake.sizes = { responses: 1, answers: 1500, probe_calls: 0 };
    fake.short = "answers";
    await expect(readAll()).rejects.toThrow("readAll answers: got 999 of 1500 rows");
  });
});

describe("readStats", () => {
  it("pages too, so the admin counts are whole", async () => {
    fake.sizes = { responses: 1200, probe_calls: 5 };
    const stats = await readStats();
    expect(stats.responses).toHaveLength(1200);
    expect(stats.calls).toHaveLength(5);
  });
});
