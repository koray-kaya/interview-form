import { describe, expect, it } from "vitest";
import { inviteLinks, personalCode } from "@/links";

describe("inviteLinks", () => {
  it("builds the German and English link for a tag", () => {
    expect(inviteLinks("https://example.ch", "CHE-123.456.788")).toEqual({
      de: "https://example.ch/?c=CHE-123.456.788&l=de",
      en: "https://example.ch/?c=CHE-123.456.788&l=en",
    });
  });
  it("encodes what a URL cannot carry as it is", () => {
    expect(inviteLinks("https://example.ch", "CHE 123 456 788").de).toBe("https://example.ch/?c=CHE+123+456+788&l=de");
  });
});

describe("personalCode", () => {
  it("is P- and six characters that cannot be misread (no 0, O, 1, I, L)", () => {
    const code = personalCode();
    expect(code).toMatch(/^P-[2-9A-HJKMNP-Z]{6}$/);
  });
  it("uses the random source it is given", () => {
    expect(personalCode(() => 0)).toBe("P-222222");
  });
  it("differs from call to call", () => {
    const codes = new Set(Array.from({ length: 50 }, () => personalCode()));
    expect(codes.size).toBe(50);
  });
});
