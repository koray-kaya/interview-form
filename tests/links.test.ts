import { describe, expect, it } from "vitest";
import { inviteLinks } from "@/links";

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

