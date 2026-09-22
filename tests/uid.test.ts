import { describe, expect, it } from "vitest";
import { isValidUid } from "@/uid";

// Expected values computed with the original Python rule (company-reach tools/uid.py).
describe("isValidUid", () => {
  it("accepts numbers with a correct check digit, in the usual spellings", () => {
    for (const uid of ["CHE123456788", "CHE-123.456.788", "CHE 123 456 788", "che-000.000.046", "CHE100000006"]) {
      expect(isValidUid(uid)).toBe(true);
    }
  });

  it("rejects a wrong check digit", () => {
    expect(isValidUid("CHE123456789")).toBe(false);
    expect(isValidUid("CHE000000047")).toBe(false);
  });

  it("rejects a prefix whose check digit would be 10 (never issued)", () => {
    for (let last = 0; last <= 9; last++) expect(isValidUid(`CHE00000003${last}`)).toBe(false);
  });

  it("rejects anything else", () => {
    for (const value of ["", "123456788", "CHE12345678", "CHE1234567888", "DE123456788", "CHE-123.456.788 MWST extra", "CHE12345678X"]) {
      expect(isValidUid(value)).toBe(false);
    }
  });
});
