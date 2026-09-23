import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerRow, ResponseRow } from "@/db";
import { FORM_VERSION } from "@/form";

vi.mock("@/db", () => ({ getResponse: vi.fn(), saveAnswer: vi.fn(async () => true), setLang: vi.fn(async () => {}) }));
import * as db from "@/db";
import { POST } from "@/app/api/responses/[id]/answers/route";

const ID = "3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f";

function stored(answers: AnswerRow[], overrides: Partial<ResponseRow> = {}) {
  vi.mocked(db.getResponse).mockResolvedValue({
    response: {
      id: ID, company_uid: null, probe_allowed: false, lang: "en", form_version: FORM_VERSION,
      consented_at: "2026-09-22T10:00:00Z", completed_at: null, created_at: "2026-09-22T10:00:00Z",
      ...overrides,
    },
    answers,
  });
}

const row = (question_id: string, value: AnswerRow["value"]): AnswerRow => ({
  question_id, followup_index: 0, question_text: "…", value,
});

function answer(body: unknown, id = ID) {
  return POST(
    new Request(`http://localhost/api/responses/${id}/answers`, {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/responses/:id/answers", () => {
  it("stores the answer with the question text from the form, in the response's language", async () => {
    stored([], { lang: "de" });
    const response = await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ followUp: null });
    expect(db.saveAnswer).toHaveBeenCalledWith({
      responseId: ID, questionId: "role", followupIndex: 0, questionText: "Ihre Rolle",
      value: { option: "sales" }, pruned: [],
    });
  });

  it("stores the question text in the language the participant switched to", async () => {
    stored([], { lang: "de" });
    await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" }, lang: "en" });
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0].questionText).toBe("Your role");
  });

  it("records the switched language on the response", async () => {
    stored([], { lang: "de" });
    await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" }, lang: "en" });
    expect(db.setLang).toHaveBeenCalledWith(ID, "en");
  });

  it("leaves the response alone when the language did not change", async () => {
    stored([], { lang: "de" });
    await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" }, lang: "de" });
    expect(db.setLang).not.toHaveBeenCalled();
  });

  it("keeps the response's own language when the request names none", async () => {
    stored([], { lang: "de" });
    await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } });
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0].questionText).toBe("Ihre Rolle");
    expect(db.setLang).not.toHaveBeenCalled();
  });

  it("writes nothing when the same answer arrives again (retry, or OK after Back)", async () => {
    stored([row("followup", { email: "a@b.ch", options: ["conversation"] } as never)]);
    const response = await answer({ questionId: "followup", followupIndex: 0, value: { options: ["conversation"], email: "a@b.ch" } });
    expect(response.status).toBe(200);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("prunes case and duration when relations becomes none", async () => {
    stored([row("relations", { options: ["customer"] }), row("case", { text: "c" }), row("duration", { option: "lt2h" })]);
    await answer({ questionId: "relations", followupIndex: 0, value: { options: ["none"] } });
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0].pruned).toEqual(["case", "duration"]);
  });

  it("does not store an e-mail the participant opted out of", async () => {
    stored([]);
    await answer({ questionId: "followup", followupIndex: 0, value: { options: ["neither"], email: "a@b.ch" } });
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0].value).toEqual({ options: ["neither"] });
  });

  it("refuses an invalid value with the form's own message", async () => {
    stored([]);
    const response = await answer({ questionId: "case", followupIndex: 0, value: { text: "   " } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Please answer this question." });
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("refuses an unknown question, a skipped question and a follow-up index before M3", async () => {
    stored([row("relations", { options: ["none"] })]);
    expect((await answer({ questionId: "nope", followupIndex: 0, value: { text: "x" } })).status).toBe(400);
    expect((await answer({ questionId: "case", followupIndex: 0, value: { text: "x" } })).status).toBe(400);
    expect((await answer({ questionId: "role", followupIndex: 1, value: { option: "sales" } })).status).toBe(400);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("refuses a completed response with 409 and an unknown one with 404", async () => {
    stored([], { completed_at: "2026-09-22T11:00:00Z" });
    expect((await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } })).status).toBe(409);
    vi.mocked(db.getResponse).mockResolvedValue(null);
    expect((await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } })).status).toBe(404);
    expect((await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } }, "nope")).status).toBe(404);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("answers 409 when the response was completed between read and write", async () => {
    stored([]);
    vi.mocked(db.saveAnswer).mockResolvedValueOnce(false);
    expect((await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } })).status).toBe(409);
  });
});
