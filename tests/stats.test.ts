import { describe, expect, it } from "vitest";
import { summarize, type StatsCall, type StatsResponse } from "@/stats";

const NOW = new Date("2026-10-10T12:00:00Z");
const r = (overrides: Partial<StatsResponse>): StatsResponse => ({
  company_uid: "CHE-123.456.788",
  lang: "de",
  form_version: "2.0.0",
  created_at: "2026-10-10T08:00:00Z",
  completed_at: "2026-10-10T08:12:00Z",
  ...overrides,
});

describe("summarize", () => {
  const responses: StatsResponse[] = [
    r({}),
    r({ lang: "en", company_uid: "P-7K3Q9X", created_at: "2026-10-05T08:00:00Z", completed_at: "2026-10-05T08:10:00Z" }),
    r({ company_uid: null, completed_at: null }),
    r({ company_uid: "SMOKE" }),
    r({ form_version: "1.0.0" }),
  ];
  const calls: StatsCall[] = [
    { decision: "ask" }, { decision: "stop" }, { decision: "ask" }, { decision: "error" },
  ];
  const s = summarize(responses, calls, "2.0.0", NOW);

  it("counts completed and unfinished responses of this form, without the smoke test", () => {
    expect(s.completed).toBe(2);
    expect(s.unfinished).toBe(1);
  });
  it("counts today's and this week's completions", () => {
    expect(s.completedToday).toBe(1);
    expect(s.completedLast7Days).toBe(2);
  });
  it("splits completed responses by language and by kind of link", () => {
    expect(s.byLang).toEqual({ de: 1, en: 1 });
    expect(s.byLink).toEqual({ uid: 1, personal: 1, none: 0 });
  });
  it("counts the model's decisions", () => {
    expect(s.calls).toEqual({ total: 4, asked: 2, errors: 1 });
  });
  it("reports the median minutes of completed responses", () => {
    expect(s.medianMinutes).toBe(11);
  });
  it("handles an empty database", () => {
    expect(summarize([], [], "2.0.0", NOW)).toMatchObject({ completed: 0, unfinished: 0, medianMinutes: null });
  });
});
