// POST /api/responses/:id/answers — stores one answer. The server applies the
// same rule as the browser (applyAnswer in the engine): the value is cleaned,
// checked, and whatever it makes obsolete is deleted in the same transaction.
// The question text stored with the answer comes from the form, never from
// the request. Follow-ups (followupIndex 1–2) arrive in M3.
import { z } from "zod";
import { countProbeCalls, getResponse, logProbeCall, saveAnswer, setLang, type AnswerRow } from "@/db";
import { AnswerValueSchema, applyAnswer, isSkipped, sameAnswer, validate, type AnswerValue } from "@/engine";
import { FORM, type OpenQuestion, type Question } from "@/form";
import { probeEnabled } from "@/env";
import { t, type Lang } from "@/i18n";
import { isUuid, json, readJson } from "@/http";
import { runProbe, type Turn } from "@/probe";
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

  const followUp = await probeAnswer({ id, question, lang, text: cleaned, rows: found.answers, allowed: found.response.probe_allowed });
  return json(200, { followUp });
}

const written = (value: AnswerValue | undefined): string => (value && "text" in value ? value.text : "");

/** The question and its answer, then each follow-up that was asked and answered. */
function transcript(questionId: string, asked: string, answer: string, rows: AnswerRow[]): Turn[] {
  const followUps = rows
    .filter((row) => row.question_id === questionId && row.followup_index > 0)
    .sort((a, b) => a.followup_index - b.followup_index)
    .map((row) => ({ question: row.question_text, answer: written(row.value) }));
  return [{ question: asked, answer }, ...followUps];
}

const isProbed = (question: Question): question is OpenQuestion & { probe: NonNullable<OpenQuestion["probe"]> } =>
  question.type === "open" && question.probe !== undefined;

/**
 * One model call after a changed answer, when the invitation carried a valid
 * company number, the kill switch is on and the question has calls left. Every
 * outcome is logged; only "ask" reaches the participant.
 */
async function probeAnswer(input: {
  id: string;
  question: Question;
  lang: Lang;
  text: AnswerValue;
  rows: AnswerRow[];
  allowed: boolean;
}): Promise<{ index: number; text: string } | null> {
  const { id, question, lang, rows } = input;
  if (!isProbed(question) || !input.allowed || !probeEnabled()) return null;

  const made = await countProbeCalls(id, question.id);
  if (made >= question.probe.maxFollowUps) return null;
  const index = made + 1;

  const result = await runProbe({
    question,
    lang,
    transcript: transcript(question.id, t(question.text, lang), written(input.text), rows),
    context: (question.probe.context ?? []).flatMap((earlier) => {
      const answered = FORM.questions.find((q) => q.id === earlier);
      const fixed = rows.find((row) => row.question_id === earlier && row.followup_index === 0);
      if (!answered || !fixed) return [];
      return transcript(earlier, t(answered.text, lang), written(fixed.value), rows);
    }),
  });

  await logProbeCall({
    response_id: id,
    question_id: question.id,
    followup_index: index,
    model: result.model,
    prompt_version: result.promptVersion,
    decision: result.decision,
    followup_text: result.decision === "ask" ? (result.followUp ?? null) : null,
    reason: result.reason ?? null,
    error_class: result.errorClass ?? null,
    input_tokens: result.inputTokens ?? null,
    output_tokens: result.outputTokens ?? null,
    latency_ms: result.latencyMs,
  });

  return result.decision === "ask" && result.followUp ? { index, text: result.followUp } : null;
}
