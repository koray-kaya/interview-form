import { describe, expect, it } from "vitest";
import { FORM, FORM_VERSION } from "@/form";

describe("FORM", () => {
  it("has a semantic version", () => {
    expect(FORM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(FORM.version).toBe(FORM_VERSION);
  });

  it("has eight questions with unique ids", () => {
    const ids = FORM.questions.map((q) => q.id);
    expect(ids).toEqual(["role", "size", "relations", "case", "duration", "pains", "gains", "followup"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has both languages on every text and option", () => {
    for (const q of FORM.questions) {
      expect(q.text.de.length).toBeGreaterThan(0);
      expect(q.text.en.length).toBeGreaterThan(0);
      if (q.type === "single" || q.type === "multi") {
        expect(q.options.length).toBeGreaterThan(1);
        expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
        for (const o of q.options) {
          expect(o.label.de.length).toBeGreaterThan(0);
          expect(o.label.en.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("probes only the three open questions, two follow-ups each", () => {
    const probed = FORM.questions.filter((q) => q.type === "open" && q.probe);
    expect(probed.map((q) => q.id)).toEqual(["case", "pains", "gains"]);
    for (const q of probed) {
      if (q.type === "open" && q.probe) expect(q.probe.maxFollowUps).toBe(2);
    }
  });

  it("caps open answers at 4000 characters", () => {
    for (const q of FORM.questions) if (q.type === "open") expect(q.maxChars).toBe(4000);
  });

  it("skips case and duration when relations is none", () => {
    expect(FORM.skips).toEqual([{ when: { question: "relations", is: "none" }, skip: ["case", "duration"] }]);
    const relations = FORM.questions.find((q) => q.id === "relations");
    expect(relations?.type === "multi" && relations.exclusive).toEqual(["none"]);
  });

  it("asks for an e-mail on followup unless neither is chosen", () => {
    const f = FORM.questions.find((q) => q.id === "followup");
    expect(f?.type === "multi" && f.email?.unlessOption).toBe("neither");
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
