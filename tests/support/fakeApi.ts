// An in-memory stand-in for src/api.ts, used by the component tests. It keeps
// responses in a Map and applies the same engine rule as the real server, so a
// test can check what "the server" holds after the participant clicks.
// Follow-ups are scripted: push onto `server.followUps` what the model should
// ask next, and the fake hands them out one answer at a time, as the route does.
import { vi } from "vitest";
import { applyAnswer, isEscape, type Answers, type AnswerValue } from "@/engine";
import { FORM, FORM_VERSION } from "@/form";
import type { Lang } from "@/i18n";
import { isComplete, referenceCode } from "@/responses";

type Asked = { questionId: string; index: number; text: string; answer?: string };
type Stored = { lang: Lang; answers: Answers; completed: boolean; asked: Asked[] };

export const server = {
  responses: new Map<string, Stored>(),
  failNextAnswer: false,
  /** What the model asks next, in order; each stored answer takes one. */
  followUps: [] as { index: number; text: string }[],
  reset() {
    this.responses.clear();
    this.failNextAnswer = false;
    this.followUps = [];
  },
};

let counter = 0;

const written = (value: AnswerValue): string => ("text" in value ? value.text : "");

export const fakeApi = {
  ApiError: class ApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  },
  startResponse: vi.fn(async ({ lang }: { c?: string; lang: Lang }) => {
    counter += 1;
    const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
    server.responses.set(id, { lang, answers: {}, completed: false, asked: [] });
    return { id, probeAllowed: false };
  }),
  fetchResponse: vi.fn(async (id: string) => {
    const stored = server.responses.get(id);
    if (!stored) return null;
    return {
      lang: stored.lang,
      formVersion: FORM_VERSION,
      completed: stored.completed,
      pending: stored.asked
        .filter((ask) => ask.answer === undefined)
        .map((ask) => ({ questionId: ask.questionId, index: ask.index, text: ask.text })),
      answered: [
        ...Object.entries(stored.answers).map(([questionId, value]) => ({
          questionId, followupIndex: 0, questionText: "…", value,
        })),
        ...stored.asked
          .filter((ask) => ask.answer !== undefined)
          .map((ask) => ({
            questionId: ask.questionId,
            followupIndex: ask.index,
            questionText: ask.text,
            value: { text: ask.answer as string } as AnswerValue,
          })),
      ],
    };
  }),
  postAnswer: vi.fn(async (id: string, questionId: string, value: AnswerValue, lang: Lang, followupIndex = 0) => {
    if (server.failNextAnswer) {
      server.failNextAnswer = false;
      throw new TypeError("network down");
    }
    const stored = server.responses.get(id)!;
    stored.lang = lang;
    if (followupIndex > 0) {
      const ask = stored.asked.find((row) => row.questionId === questionId && row.index === followupIndex);
      if (!ask) throw new fakeApi.ApiError(400, "follow-up not asked");
      ask.answer = written(value);
    } else {
      stored.answers = applyAnswer(FORM, stored.answers, questionId, value);
    }
    // only the three open questions are probed, and never their escape, as on the server
    const question = FORM.questions.find((q) => q.id === questionId);
    const probed = question?.type === "open" && question.probe !== undefined && !isEscape(question, value);
    const next = probed ? server.followUps.shift() : undefined;
    if (!next) return { followUp: null };
    stored.asked.push({ questionId, index: next.index, text: next.text });
    return { followUp: next };
  }),
  completeResponse: vi.fn(async (id: string) => {
    const stored = server.responses.get(id)!;
    if (!isComplete(stored.answers)) throw new fakeApi.ApiError(409, "questions left unanswered");
    if (stored.asked.some((ask) => ask.answer === undefined)) {
      throw new fakeApi.ApiError(409, "follow-up left unanswered");
    }
    stored.completed = true;
    return { referenceCode: referenceCode(id) };
  }),
};
