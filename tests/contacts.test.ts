import { describe, expect, it } from "vitest";
import { contacts } from "@/contacts";
import { FORM } from "@/form";
import { EMAIL, UID, answers, responses } from "./results-fixture";

describe("contacts", () => {
  it("lists only the people who asked to be contacted, with their tag and address", () => {
    expect(contacts(FORM, responses, answers)).toEqual([
      {
        code: "aaaa0001",
        tag: UID,
        email: EMAIL,
        openTo: [expect.objectContaining({ id: "conversation" })],
        completedAt: "2026-10-01T08:12:00+00:00",
      },
    ]);
  });

  it("is empty when no one asked", () => {
    expect(contacts(FORM, [], [])).toEqual([]);
  });
});
