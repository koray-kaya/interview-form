import { describe, expect, it } from "vitest";
import type { ResponseRow, StoredAnswer } from "@/db";
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

  it("keeps a contact who answered an older form version", () => {
    const oldResponse: ResponseRow = {
      id: "bbbb0001-0000-4000-8000-000000000001",
      company_uid: "CHE-999.999.997",
      probe_allowed: true,
      lang: "de",
      form_version: "1.0.0",
      consented_at: "2026-09-01T08:00:00+00:00",
      created_at: "2026-09-01T08:00:00+00:00",
      completed_at: "2026-09-01T08:12:00+00:00",
    };
    const oldAnswer: StoredAnswer = {
      id: "old-followup",
      response_id: oldResponse.id,
      question_id: "followup",
      followup_index: 0,
      question_text: "followup",
      value: { options: ["conversation"], email: "alt.kontakt@beispiel-ag.ch" },
      created_at: "2026-09-01T08:12:00+00:00",
    };
    expect(contacts(FORM, [oldResponse], [oldAnswer])).toEqual([
      {
        code: "bbbb0001",
        tag: "CHE-999.999.997",
        email: "alt.kontakt@beispiel-ag.ch",
        openTo: [expect.objectContaining({ id: "conversation" })],
        completedAt: "2026-09-01T08:12:00+00:00",
      },
    ]);
  });
});
