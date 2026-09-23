// POST /api/responses/:id/answers — stores one answer. The server applies the
// same rule as the browser (applyAnswer in the engine): the value is cleaned,
// checked, and whatever it makes obsolete is deleted in the same transaction.
// The question text stored with the answer comes from the form, never from
// the request. Follow-ups (followupIndex 1–2) arrive in M3.
import { z } from "zod";
import { getResponse, saveAnswer, setLang } from "@/db";
import { AnswerValueSchema, applyAnswer, isSkipped, sameAnswer, validate } from "@/engine";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { isUuid, json, readJson } from "@/http";
import { fixedAnswers } from "@/responses";

const Body = z.object({
  questionId: z.string().max(64),
  followupIndex: z.literal(0),
  value: AnswerValueSchema,
  /** The language on screen when the answer was given; absent means unchanged. */
  lang: z.enum(["de", "en"]).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const parsed = await readJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  if (!isUuid(id)) return json(404, { error: "not found" });

  const { questionId, value } = parsed.data;
  const question = FORM.questions.find((q) => q.id === questionId);
  if (!question) return json(400, { error: "unknown question" });

  const found = await getResponse(id);
  if (!found) return json(404, { error: "not found" });
  if (found.response.completed_at !== null) return json(409, { error: "response already completed" });

  // The participant may have switched language since the response was created.
  // The request decides what they saw; the text itself still comes from the form.
  const lang = parsed.data.lang ?? found.response.lang;
  if (lang !== found.response.lang) await setLang(id, lang);

  const before = fixedAnswers(found.answers);
  if (isSkipped(FORM, questionId, before)) return json(400, { error: "question not active" });

  const problem = validate(question, value, lang);
  if (problem) return json(400, { error: problem });

  const after = applyAnswer(FORM, before, questionId, value);
  const cleaned = after[questionId];
  const pruned = Object.keys(before).filter((key) => key !== questionId && !(key in after));

  const previous = before[questionId];
  if (previous && sameAnswer(previous, cleaned) && pruned.length === 0) return json(200, { followUp: null });

  const saved = await saveAnswer({
    responseId: id,
    questionId,
    followupIndex: 0,
    questionText: t(question.text, lang),
    value: cleaned,
    pruned,
  });
  if (!saved) return json(409, { error: "response already completed" });

  return json(200, { followUp: null });
}
