import { describe, expect, it } from "vitest";
import { parseLang, t } from "@/i18n";

describe("t", () => {
  it("picks the requested language", () => {
    expect(t({ de: "Hallo", en: "Hello" }, "de")).toBe("Hallo");
    expect(t({ de: "Hallo", en: "Hello" }, "en")).toBe("Hello");
  });
});

describe("parseLang", () => {
  it("defaults to German", () => {
    expect(parseLang(undefined)).toBe("de");
    expect(parseLang("fr")).toBe("de");
    expect(parseLang(["en", "de"])).toBe("de");
  });
  it("selects English only on exactly 'en'", () => {
    expect(parseLang("en")).toBe("en");
  });
});
