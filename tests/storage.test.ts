import { beforeEach, describe, expect, it } from "vitest";
import { FORM_VERSION } from "@/form";
import { clearSaved, loadSaved, saveSaved } from "@/storage";

const ID = "3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f";

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("round-trips a saved state", () => {
    saveSaved({ version: FORM_VERSION, lang: "de", stage: "questions", responseId: ID });
    expect(loadSaved()).toEqual({ version: FORM_VERSION, lang: "de", stage: "questions", responseId: ID });
  });
  it("keeps the reference code once done", () => {
    saveSaved({ version: FORM_VERSION, lang: "en", stage: "done", responseId: ID, referenceCode: "3f1c2b7a", inTouch: true });
    expect(loadSaved()).toEqual({ version: FORM_VERSION, lang: "en", stage: "done", responseId: ID, referenceCode: "3f1c2b7a", inTouch: true });
  });
  it("returns null when nothing is saved", () => {
    expect(loadSaved()).toBeNull();
  });
  it("ignores another form version", () => {
    saveSaved({ version: "0.0.1", lang: "de", stage: "questions", responseId: ID });
    expect(loadSaved()).toBeNull();
  });
  it("ignores unreadable data", () => {
    localStorage.setItem("interview-form", "{not json");
    expect(loadSaved()).toBeNull();
  });
  it("ignores data of the wrong shape, including the M1 shape with answers", () => {
    const bad = [
      { version: FORM_VERSION, lang: "de", stage: "questions" }, // no responseId
      { version: FORM_VERSION, lang: "fr", stage: "questions", responseId: ID },
      { version: FORM_VERSION, lang: "de", stage: "later", responseId: ID },
      { version: FORM_VERSION, lang: "de", stage: "questions", responseId: "not-a-uuid" },
      { version: FORM_VERSION, lang: "de", stage: "questions", answers: { role: { option: "owner" } } },
      null,
      [],
    ];
    for (const value of bad) {
      localStorage.setItem("interview-form", JSON.stringify(value));
      expect(loadSaved()).toBeNull();
    }
  });
  it("never writes an answer to the browser", () => {
    saveSaved({ version: FORM_VERSION, lang: "en", stage: "questions", responseId: ID, answers: { case: { text: "secret" } } } as never);
    expect(localStorage.getItem("interview-form")).not.toContain("secret");
  });
  it("clears", () => {
    saveSaved({ version: FORM_VERSION, lang: "en", stage: "welcome", responseId: null });
    clearSaved();
    expect(loadSaved()).toBeNull();
  });
});
