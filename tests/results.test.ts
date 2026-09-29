import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import {
  countedResponses, firstCode, openAnswers, percent, questionResults, responseView,
  resultsLang, shareLabel, tiles, withLang, type QuestionResult,
} from "@/results";
import { EMAIL, R1, R2, UID, rows } from "./results-fixture";

const EMPTY = { responses: [], answers: [], probe_calls: [] };
const result = (id: string): QuestionResult => questionResults(FORM, rows).find((r) => r.question.id === id)!;
const counts = (id: string) => {
  const r = result(id);
  return r.type === "single" || r.type === "multi" ? Object.fromEntries(r.counts.map((c) => [c.option.id, c.count])) : null;
};

describe("small helpers", () => {
  it("reads ?l= as German only when it says de, once", () => {
    expect(resultsLang("de")).toBe("de");
    expect(resultsLang("en")).toBe("en");
    expect(resultsLang(undefined)).toBe("en");
    expect(resultsLang(["de", "de"])).toBe("en");
  });

  it("keeps ?l=de on links", () => {
    expect(withLang("/admin/results/open", "de")).toBe("/admin/results/open?l=de");
    expect(withLang("/admin/results/open", "en")).toBe("/admin/results/open");
  });

  it("puts the count before the share, and never divides by zero", () => {
    expect(shareLabel(3, 5)).toBe("3 / 5 · 60%");
    expect(shareLabel(0, 0)).toBe("0 / 0");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("countedResponses", () => {
  it("keeps completed responses of this form version, without the smoke test's, in order of completion", () => {
    expect(countedResponses(FORM, rows.responses).map((r) => r.id)).toEqual([R1, R2]);
    expect(firstCode(FORM, rows)).toBe("aaaa0001");
    expect(firstCode(FORM, EMPTY)).toBeNull();
  });
});

describe("questionResults", () => {
  it("numbers all fourteen questions in form order", () => {
    expect(questionResults(FORM, rows).map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("counts single and multiple choices over n, which the skip rules lower", () => {
    expect(result("role").n).toBe(2);
    expect(counts("role")).toEqual({ owner: 1, sales: 0, purchasing: 1, other: 0 });
    expect(result("duration").n).toBe(1);
    expect(result("sources").n).toBe(1);
    expect(counts("skipped")).toMatchObject({ "no-time": 1, none: 1 });
    expect(counts("followup")).toEqual({ conversation: 1, trial: 0, neither: 1 });
  });

  it("ignores an option id the form no longer has", () => {
    expect(counts("cost")).toEqual({ no: 0, "paid-report": 1, subscription: 0, "outside-help": 0, "dont-know": 0 });
  });

  it("counts each row of the rows question over its scale", () => {
    const r = result("activities");
    if (r.type !== "rows") throw new Error("rows expected");
    const competitors = r.rows.find((x) => x.row.id === "competitors")!;
    expect(Object.fromEntries(competitors.counts.map((c) => [c.option.id, c.count]))).toEqual({ never: 2, "1-2": 0, "3-6": 0, monthly: 0, weekly: 0 });
  });

  it("summarises the open questions without their text", () => {
    expect(result("case")).toMatchObject({ n: 2, written: 1, escaped: 1, followedUp: 1, followUps: 1 });
    expect(result("pains")).toMatchObject({ n: 2, written: 2, escaped: 0, followedUp: 1, followUps: 1 });
    expect(result("gains")).toMatchObject({ n: 1, written: 1, followedUp: 1, followUps: 2 });
  });

  it("gives n = 0 everywhere when nothing is completed yet", () => {
    expect(questionResults(FORM, EMPTY).every((r) => r.n === 0)).toBe(true);
  });
});

describe("tiles", () => {
  it("counts the completed responses, their time, follow-ups and model calls", () => {
    expect(tiles(FORM, rows)).toEqual({ completed: 2, medianMinutes: 16, followUps: 4, calls: 7, stops: 3, errors: 0 });
    expect(tiles(FORM, EMPTY)).toEqual({ completed: 0, medianMinutes: null, followUps: 0, calls: 0, stops: 0, errors: 0 });
  });
});

describe("openAnswers", () => {
  it("lists each counted answer of each open question with its thread", () => {
    const sections = openAnswers(FORM, rows);
    expect(sections.map((s) => [s.number, s.question.id, s.entries.length])).toEqual([[4, "case", 2], [8, "pains", 2], [9, "gains", 1]]);
    const [first, escaped] = sections[0].entries;
    expect(first.code).toBe("aaaa0001");
    expect(first.thread?.steps[0].decisions[0].followUp).toBe("Welche Quellen haben Sie dafür genutzt?");
    expect(escaped).toEqual({ code: "aaaa0002", value: { option: "none" }, thread: null });
    expect(sections[2].entries[0].thread?.end).toBe("limit");
  });
});

describe("responseView", () => {
  it("gives one response in form order, with its neighbours", () => {
    const view = responseView(FORM, rows, "aaaa0002")!;
    expect(view).toMatchObject({ code: "aaaa0002", position: 2, total: 2, previous: "aaaa0001", next: null, lang: "de", minutes: 20, followUps: 1 });
    expect(view.items).toHaveLength(14);
  });

  it("says which rule skipped a question", () => {
    const view = responseView(FORM, rows, "aaaa0002")!;
    const duration = view.items.find((i) => i.question.id === "duration")!;
    expect(duration).toMatchObject({ state: "skipped", because: { number: 4, kind: "is", option: { id: "none" } } });
    const sources = view.items.find((i) => i.question.id === "sources")!;
    expect(sources).toMatchObject({ state: "skipped", because: { number: 10, kind: "every", option: { id: "never" } } });
  });

  it("drops the e-mail address and never carries the company number", () => {
    const view = responseView(FORM, rows, "aaaa0001")!;
    expect(view.items.find((i) => i.question.id === "followup")).toMatchObject({ state: "answered", value: { options: ["conversation"] } });
    const text = JSON.stringify([view, questionResults(FORM, rows), openAnswers(FORM, rows), tiles(FORM, rows)]);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(UID);
  });

  it("returns null for a code that is not a counted response", () => {
    expect(responseView(FORM, rows, "aaaa0003")).toBeNull();
    expect(responseView(FORM, rows, "ffffffff")).toBeNull();
  });
});
