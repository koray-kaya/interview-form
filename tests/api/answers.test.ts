import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerRow, ResponseRow } from "@/db";
import type { ProbeResult } from "@/probe";
import { FORM_VERSION } from "@/form";

vi.mock("@/db", () => ({
  getResponse: vi.fn(),
  saveAnswer: vi.fn(async () => true),
  setLang: vi.fn(async () => {}),
  countProbeCalls: vi.fn(async () => 0),
  logProbeCall: vi.fn(async () => {}),
  askedFollowUps: vi.fn(async () => []),
}));
vi.mock("@/probe", () => ({ runProbe: vi.fn() }));
import * as db from "@/db";
import * as probe from "@/probe";
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // clearAllMocks forgets the calls but keeps the implementations, so a
  // mockResolvedValue set in one test would otherwise leak into the next
  vi.mocked(db.countProbeCalls).mockResolvedValue(0);
  vi.mocked(db.askedFollowUps).mockResolvedValue([]);
});

/** A response whose invitation carried a valid UID, with probing switched on. */
function probeable(answers: AnswerRow[] = []) {
  vi.stubEnv("PROBE_ENABLED", "true");
  stored(answers, { probe_allowed: true, lang: "en" });
}

function decides(result: Partial<ProbeResult> = {}) {
  vi.mocked(probe.runProbe).mockResolvedValue({
    decision: "ask",
    followUp: "Where did you look?",
    reason: "no source named",
    model: "anthropic/claude-sonnet-5",
    promptVersion: "1",
    latencyMs: 12,
    inputTokens: 900,
    outputTokens: 30,
    ...result,
  });
}

const caseAnswer = { questionId: "case", followupIndex: 0, value: { text: "We looked into a new supplier." } };

describe("POST /api/responses/:id/answers — the probe", () => {
  it("asks a follow-up when the model says the element is missing", async () => {
    probeable();
    decides();
    const response = await answer(caseAnswer);
    expect(await response.json()).toEqual({ followUp: { index: 1, text: "Where did you look?" } });
  });

  it("logs every call with the decision, the model and its cost", async () => {
    probeable();
    decides();
    await answer(caseAnswer);
    expect(db.logProbeCall).toHaveBeenCalledWith(
      expect.objectContaining({
        response_id: ID,
        question_id: "case",
        followup_index: 1,
        decision: "ask",
        followup_text: "Where did you look?",
        model: "anthropic/claude-sonnet-5",
        prompt_version: "1",
        input_tokens: 900,
        output_tokens: 30,
      }),
    );
  });

  it("shows no follow-up when the model stops", async () => {
    probeable();
    decides({ decision: "stop", followUp: undefined });
    const response = await answer(caseAnswer);
    expect(await response.json()).toEqual({ followUp: null });
    expect(db.logProbeCall).toHaveBeenCalledWith(expect.objectContaining({ decision: "stop", followup_text: null }));
  });

  it("carries on when the model fails, and records the failure", async () => {
    probeable();
    decides({ decision: "error", followUp: undefined, reason: undefined, errorClass: "timeout" });
    const response = await answer(caseAnswer);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ followUp: null });
    expect(db.logProbeCall).toHaveBeenCalledWith(expect.objectContaining({ decision: "error", error_class: "timeout" }));
  });

  it("does not probe when the invitation carried no valid company number", async () => {
    vi.stubEnv("PROBE_ENABLED", "true");
    stored([], { probe_allowed: false });
    await answer(caseAnswer);
    expect(probe.runProbe).not.toHaveBeenCalled();
  });

  it("does not probe while the kill switch is off", async () => {
    stored([], { probe_allowed: true });
    await answer(caseAnswer);
    expect(probe.runProbe).not.toHaveBeenCalled();
  });

  it("never exceeds the question's limit of model calls", async () => {
    probeable();
    vi.mocked(db.countProbeCalls).mockResolvedValue(2);
    await answer(caseAnswer);
    expect(probe.runProbe).not.toHaveBeenCalled();
  });

  it("does not probe a question the form does not probe", async () => {
    probeable();
    await answer({ questionId: "role", followupIndex: 0, value: { option: "sales" } });
    expect(probe.runProbe).not.toHaveBeenCalled();
  });

  it("does not probe when the answer came back unchanged", async () => {
    probeable([row("case", { text: "We looked into a new supplier." })]);
    await answer(caseAnswer);
    expect(probe.runProbe).not.toHaveBeenCalled();
  });

  it("stores a follow-up answer with the question text the model wrote", async () => {
    probeable([row("case", { text: "We looked into a new supplier." })]);
    vi.mocked(db.askedFollowUps).mockResolvedValue([
      { question_id: "case", followup_index: 1, followup_text: "Where did you look?" },
    ]);
    vi.mocked(db.countProbeCalls).mockResolvedValue(1);
    decides({ decision: "stop", followUp: undefined });
    const response = await answer({ questionId: "case", followupIndex: 1, value: { text: "The register." } });
    expect(response.status).toBe(200);
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0]).toMatchObject({
      followupIndex: 1,
      questionText: "Where did you look?",
      value: { text: "The register." },
    });
  });

  it("refuses a follow-up that was never asked", async () => {
    probeable([row("case", { text: "We looked into a new supplier." })]);
    const response = await answer({ questionId: "case", followupIndex: 1, value: { text: "The register." } });
    expect(response.status).toBe(400);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("refuses a follow-up that was already answered", async () => {
    probeable([
      row("case", { text: "We looked into a new supplier." }),
      { question_id: "case", followup_index: 1, question_text: "Where did you look?", value: { text: "The register." } },
    ]);
    vi.mocked(db.askedFollowUps).mockResolvedValue([
      { question_id: "case", followup_index: 1, followup_text: "Where did you look?" },
    ]);
    const response = await answer({ questionId: "case", followupIndex: 1, value: { text: "Again." } });
    expect(response.status).toBe(400);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("judges the follow-up answer too, while a call is left", async () => {
    probeable([row("case", { text: "We looked into a new supplier." })]);
    vi.mocked(db.askedFollowUps).mockResolvedValue([
      { question_id: "case", followup_index: 1, followup_text: "Where did you look?" },
    ]);
    vi.mocked(db.countProbeCalls).mockResolvedValue(1);
    decides({ followUp: "Which register was that?" });
    const response = await answer({ questionId: "case", followupIndex: 1, value: { text: "The register." } });
    expect(await response.json()).toEqual({ followUp: { index: 2, text: "Which register was that?" } });
    const [input] = vi.mocked(probe.runProbe).mock.calls[0];
    expect(input.transcript.map((turn) => turn.answer)).toEqual(["We looked into a new supplier.", "The register."]);
  });

  it("sends the answer and the earlier follow-ups to the model, in order", async () => {
    probeable([row("case", { text: "An older answer." })]);
    decides();
    await answer(caseAnswer);
    const [input] = vi.mocked(probe.runProbe).mock.calls[0];
    expect(input.question.id).toBe("case");
    expect(input.lang).toBe("en");
    expect(input.transcript[0].answer).toBe("We looked into a new supplier.");
  });
  it("never asks the model about an escaped case, and stores the escape with the question text", async () => {
    probeable();
    decides();
    const response = await answer({ questionId: "case", followupIndex: 0, value: { option: "none" } });
    expect(await response.json()).toEqual({ followUp: null });
    expect(probe.runProbe).not.toHaveBeenCalled();
    expect(db.logProbeCall).not.toHaveBeenCalled();
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0]).toMatchObject({
      questionId: "case",
      value: { option: "none" },
      questionText: "Think of the last time you needed to find out something about other companies. What did you need to know, and how did you go about it?",
    });
  });

  it("gives pains no case as context when the case was escaped", async () => {
    probeable([row("case", { option: "none" })]);
    decides({ decision: "stop", followUp: undefined });
    await answer({ questionId: "pains", followupIndex: 0, value: { text: "Everything takes long." } });
    expect(vi.mocked(probe.runProbe).mock.calls[0][0].context).toEqual([]);
  });

  it("refuses a follow-up answer on a question the escape now skips", async () => {
    probeable([row("case", { option: "none" })]);
    vi.mocked(db.askedFollowUps).mockResolvedValue([{ question_id: "gains", followup_index: 1, followup_text: "What would that have changed?" }]);
    const response = await answer({ questionId: "gains", followupIndex: 1, value: { text: "We would have declined." } });
    expect(response.status).toBe(400);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("refuses the escape as the answer to a follow-up", async () => {
    probeable([row("case", { text: "We looked into a supplier." })]);
    vi.mocked(db.askedFollowUps).mockResolvedValue([{ question_id: "case", followup_index: 1, followup_text: "Where did you look?" }]);
    const response = await answer({ questionId: "case", followupIndex: 1, value: { option: "none" } });
    expect(response.status).toBe(400);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });
});

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

  it("prunes duration, cost, result and gains when the case is escaped", async () => {
    stored([
      row("case", { text: "c" }), row("duration", { option: "lt2h" }), row("cost", { options: ["no"] }),
      row("result", { option: "yes" }), row("pains", { text: "p" }), row("gains", { text: "g" }),
    ]);
    await answer({ questionId: "case", followupIndex: 0, value: { option: "none" } });
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0].pruned).toEqual(["duration", "cost", "result", "gains"]);
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

  it("refuses an unknown question, a skipped question and an unasked follow-up", async () => {
    stored([row("case", { option: "none" })]);
    expect((await answer({ questionId: "nope", followupIndex: 0, value: { text: "x" } })).status).toBe(400);
    expect((await answer({ questionId: "duration", followupIndex: 0, value: { option: "lt2h" } })).status).toBe(400);
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

  const ROWS = { "new-customers": "never", "new-suppliers": "1-2", "one-company": "3-6", competitors: "monthly", "own-position": "weekly" };

  it("stores a rows answer with the stem as its question text", async () => {
    stored([]);
    expect((await answer({ questionId: "activities", followupIndex: 0, value: { rows: ROWS } })).status).toBe(200);
    expect(vi.mocked(db.saveAnswer).mock.calls[0][0]).toMatchObject({
      questionText: "How often did this happen in the last 12 months?",
      value: { rows: ROWS },
    });
  });

  it("refuses a rows answer with a row missing or a point the scale lacks", async () => {
    stored([]);
    const four = Object.fromEntries(Object.entries(ROWS).filter(([id]) => id !== "competitors"));
    expect((await answer({ questionId: "activities", followupIndex: 0, value: { rows: four } })).status).toBe(400);
    expect((await answer({ questionId: "activities", followupIndex: 0, value: { rows: { ...ROWS, competitors: "daily" } } })).status).toBe(400);
    expect((await answer({ questionId: "case", followupIndex: 0, value: { rows: ROWS } })).status).toBe(400);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });

  it("writes nothing when the same rows arrive with their keys in another order", async () => {
    const reordered = Object.fromEntries(Object.entries(ROWS).reverse());
    stored([row("activities", { rows: reordered })]);
    expect((await answer({ questionId: "activities", followupIndex: 0, value: { rows: ROWS } })).status).toBe(200);
    expect(db.saveAnswer).not.toHaveBeenCalled();
  });
});
