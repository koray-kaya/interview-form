import { beforeEach, describe, expect, it } from "vitest";
import { FORM_VERSION } from "@/form";
import { clearSaved, loadSaved, saveSaved } from "@/storage";

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("round-trips a saved state", () => {
    saveSaved({ version: FORM_VERSION, lang: "de", stage: "questions", answers: { role: { option: "owner" } } });
    expect(loadSaved()).toEqual({ version: FORM_VERSION, lang: "de", stage: "questions", answers: { role: { option: "owner" } } });
  });
  it("returns null when nothing is saved", () => {
    expect(loadSaved()).toBeNull();
  });
  it("ignores another form version", () => {
    saveSaved({ version: "0.0.1", lang: "de", stage: "questions", answers: {} });
    expect(loadSaved()).toBeNull();
  });
  it("ignores unreadable data", () => {
    localStorage.setItem("interview-form", "{not json");
    expect(loadSaved()).toBeNull();
  });
  it("ignores data of the wrong shape", () => {
    const bad = [
      { version: FORM_VERSION, lang: "de", stage: "questions" }, // no answers
      { version: FORM_VERSION, lang: "fr", stage: "questions", answers: {} },
      { version: FORM_VERSION, lang: "de", stage: "later", answers: {} },
      { version: FORM_VERSION, lang: "de", stage: "questions", answers: { role: { option: 3 } } },
      { version: FORM_VERSION, lang: "de", stage: "questions", answers: { role: "owner" } },
      null,
      [],
    ];
    for (const value of bad) {
      localStorage.setItem("interview-form", JSON.stringify(value));
      expect(loadSaved()).toBeNull();
    }
  });
  it("keeps no answers in the browser once the form is done", () => {
    saveSaved({ version: FORM_VERSION, lang: "en", stage: "done", answers: { followup: { options: ["conversation"], email: "a@b.ch" } } });
    expect(localStorage.getItem("interview-form")).not.toContain("a@b.ch");
    expect(loadSaved()).toEqual({ version: FORM_VERSION, lang: "en", stage: "done", answers: {} });
  });
  it("clears", () => {
    saveSaved({ version: FORM_VERSION, lang: "en", stage: "done", answers: {} });
    clearSaved();
    expect(loadSaved()).toBeNull();
  });
});
