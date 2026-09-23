// An in-memory stand-in for src/api.ts, used by the component tests. It keeps
// responses in a Map and applies the same engine rule as the real server, so a
// test can check what "the server" holds after the participant clicks.
import { vi } from "vitest";
import { applyAnswer, type Answers, type AnswerValue } from "@/engine";
import { FORM, FORM_VERSION } from "@/form";
import type { Lang } from "@/i18n";
import { isComplete, referenceCode } from "@/responses";

type Stored = { lang: Lang; answers: Answers; completed: boolean };

export const server = {
  responses: new Map<string, Stored>(),
  failNextAnswer: false,
  reset() {
    this.responses.clear();
    this.failNextAnswer = false;
  },
};

let counter = 0;

export const fakeApi = {
  ApiError: class ApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  },
  startResponse: vi.fn(async ({ lang }: { c?: string; lang: Lang }) => {
    counter += 1;
    const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
    server.responses.set(id, { lang, answers: {}, completed: false });
    return { id, probeAllowed: false };
  }),
  fetchResponse: vi.fn(async (id: string) => {
    const stored = server.responses.get(id);
    if (!stored) return null;
    return {
      lang: stored.lang,
      formVersion: FORM_VERSION,
      completed: stored.completed,
      answered: Object.entries(stored.answers).map(([questionId, value]) => ({
        questionId, followupIndex: 0, questionText: "…", value,
      })),
    };
  }),
  postAnswer: vi.fn(async (id: string, questionId: string, value: AnswerValue, lang: Lang) => {
    if (server.failNextAnswer) {
      server.failNextAnswer = false;
      throw new TypeError("network down");
    }
    const stored = server.responses.get(id)!;
    stored.lang = lang;
    stored.answers = applyAnswer(FORM, stored.answers, questionId, value);
    return { followUp: null };
  }),
  completeResponse: vi.fn(async (id: string) => {
    const stored = server.responses.get(id)!;
    if (!isComplete(stored.answers)) throw new fakeApi.ApiError(409, "questions left unanswered");
    stored.completed = true;
    return { referenceCode: referenceCode(id) };
  }),
};
