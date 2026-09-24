import { describe, expect, it } from "vitest";
import { languageOf } from "../evals/language";

describe("languageOf", () => {
  it("tells a German follow-up from an English one", () => {
    expect(languageOf("Wie sind Sie dabei vorgegangen, wo oder bei wem haben Sie nachgeschaut?")).toBe("de");
    expect(languageOf("Was genau wollten Sie über die Firma herausfinden?")).toBe("de");
    expect(languageOf("How did you go about finding one, where did you look or whom did you ask?")).toBe("en");
    expect(languageOf("What would you have decided differently with such a picture?")).toBe("en");
  });
  it("says so when it cannot tell", () => {
    expect(languageOf("OK?")).toBe("unclear");
  });
});
