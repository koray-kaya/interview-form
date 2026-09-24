import { describe, expect, it } from "vitest";
import { FORM, FORM_VERSION, type Option } from "@/form";

const q = (id: string) => FORM.questions.find((x) => x.id === id)!;
const ids = (options: Option[]) => options.map((o) => o.id);
const options = (id: string) => {
  const x = q(id);
  return x.type === "single" || x.type === "multi" ? ids(x.options) : [];
};

describe("FORM", () => {
  it("is version 2.0.0", () => {
    expect(FORM_VERSION).toBe("2.0.0");
    expect(FORM.version).toBe(FORM_VERSION);
  });

  it("has the fourteen approved questions, in order, with unique ids", () => {
    const all = FORM.questions.map((x) => x.id);
    expect(all).toEqual([
      "role", "size", "customers", "case", "duration", "cost", "result",
      "pains", "gains", "activities", "who", "skipped", "sources", "followup",
    ]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("has both languages on every text, option, row, scale point and escape", () => {
    const labels: Option[] = [];
    for (const x of FORM.questions) {
      expect(x.text.de.length, x.id).toBeGreaterThan(0);
      expect(x.text.en.length, x.id).toBeGreaterThan(0);
      if (x.type === "single" || x.type === "multi") labels.push(...x.options);
      if (x.type === "rows") labels.push(...x.rows, ...x.scale);
      if (x.type === "open" && x.escape) labels.push(x.escape);
    }
    for (const o of labels) {
      expect(o.label.de.length, o.id).toBeGreaterThan(0);
      expect(o.label.en.length, o.id).toBeGreaterThan(0);
    }
  });

  it("writes German the Swiss way: no ß anywhere", () => {
    expect(JSON.stringify(FORM)).not.toContain("ß");
  });

  it("has unique option ids within each question", () => {
    for (const x of FORM.questions) {
      const own = x.type === "rows" ? [ids(x.rows), ids(x.scale)] : x.type === "open" ? [] : [ids(x.options)];
      for (const list of own) expect(new Set(list).size, x.id).toBe(list.length);
    }
  });

  it("probes only the three open questions, two follow-ups each, pains and gains with the case as context", () => {
    const probed = FORM.questions.filter((x) => x.type === "open" && x.probe);
    expect(probed.map((x) => x.id)).toEqual(["case", "pains", "gains"]);
    for (const x of probed) if (x.type === "open" && x.probe) expect(x.probe.maxFollowUps).toBe(2);
    const context = (id: string) => { const x = q(id); return x.type === "open" ? x.probe?.context : undefined; };
    expect(context("case")).toBeUndefined();
    expect(context("pains")).toEqual(["case"]);
    expect(context("gains")).toEqual(["case"]);
  });

  it("caps open answers at 4000 characters", () => {
    for (const x of FORM.questions) if (x.type === "open") expect(x.maxChars).toBe(4000);
  });

  it("offers the escape on case only", () => {
    expect(FORM.questions.filter((x) => x.type === "open" && x.escape).map((x) => x.id)).toEqual(["case"]);
    const c = q("case");
    expect(c.type === "open" && c.escape?.id).toBe("none");
  });

  it("has the two skip rules", () => {
    expect(FORM.skips).toEqual([
      { when: { question: "case", is: "none" }, skip: ["duration", "cost", "result", "gains"] },
      { when: { question: "activities", every: "never" }, skip: ["sources"] },
    ]);
  });

  it("keeps the exclusive options alone", () => {
    const exclusive = (id: string) => { const x = q(id); return x.type === "multi" ? x.exclusive : undefined; };
    expect(exclusive("cost")).toEqual(["no", "dont-know"]);
    expect(exclusive("skipped")).toEqual(["none"]);
    expect(exclusive("followup")).toEqual(["neither"]);
    expect(exclusive("sources")).toBeUndefined();
  });

  it("pins the categories the impact evaluation asks again", () => {
    expect(options("duration")).toEqual(["lt30m", "lt2h", "halfday", "day", "days"]);
    expect(options("cost")).toEqual(["no", "paid-report", "subscription", "outside-help", "dont-know"]);
    expect(options("result")).toEqual(["yes", "partly", "no-went-ahead", "no-gave-up"]);
    const a = q("activities");
    expect(a.type === "rows" && ids(a.rows)).toEqual(["new-customers", "new-suppliers", "one-company", "competitors", "own-position"]);
    expect(a.type === "rows" && ids(a.scale)).toEqual(["never", "1-2", "3-6", "monthly", "weekly"]);
  });

  it("tells people they may choose several wherever a list allows it", () => {
    for (const id of ["cost", "skipped", "sources"]) {
      expect(q(id).help, id).toEqual({ de: "Mehrfachauswahl möglich.", en: "Choose all that apply." });
    }
  });

  it("asks for an e-mail on followup unless neither is chosen", () => {
    const f = q("followup");
    expect(f.type === "multi" && f.email?.unlessOption).toBe("neither");
  });

  it("names skip conditions before the questions they skip", () => {
    // pruneSkipped walks the form once, in order; that is only correct when
    // every rule looks back, never forward.
    const at = (id: string) => FORM.questions.findIndex((x) => x.id === id);
    for (const rule of FORM.skips) {
      expect(at(rule.when.question)).toBeGreaterThanOrEqual(0);
      for (const id of rule.skip) expect(at(id)).toBeGreaterThan(at(rule.when.question));
    }
  });
});
