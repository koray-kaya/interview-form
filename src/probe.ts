// The AI probe: decides whether an open answer leaves out the element the
// question needs and, if so, writes one short follow-up. The instruction part
// is the question's own prompt file (prompts/probe-<id>.md); everything the
// participant wrote goes inside <answer> blocks, never into the instructions.
// What the model returns is checked here as well — a follow-up is shown only
// if it passes postCheck, whatever the model claims.
import { APICallError, generateText, Output, RetryError, type LanguageModel } from "ai";
import { z } from "zod";
import type { ProbeDecision } from "@/db";
import type { OpenQuestion } from "@/form";
import type { Lang } from "@/i18n";
import { loadPrompt } from "@/prompt";

export const ProbeOutputSchema = z.object({
  missing: z.boolean(),
  followUp: z.string().nullable(),
  reason: z.string().max(200),
});

export type ProbeOutput = z.infer<typeof ProbeOutputSchema>;

/** One question and the answer it received: the fixed question, then each follow-up. */
export type Turn = { question: string; answer: string };

export type ProbeInput = {
  question: OpenQuestion;
  lang: Lang;
  transcript: Turn[];
  /** An earlier question and answer the prompt may use as context (`case`). */
  context?: Turn[];
};

export const MAX_FOLLOWUP_CHARS = 200;

const LANGUAGE_NAME: Record<Lang, string> = { de: "German", en: "English" };

const URL_OR_EMAIL = /(https?:\/\/|www\.|\S+@\S+\.\S+)/i;

function block({ question, answer }: Turn): string {
  // Participant text must not close its own block: the tag sequence is removed,
  // so anything written after it stays inside the data, as text to judge.
  const text = answer.replace(/<\/?answer>/gi, "").trim();
  return `Question: "${question}"\n<answer>\n${text}\n</answer>`;
}

export function buildPrompt({ lang, transcript, context }: ProbeInput): string {
  const parts = [`Form language: ${LANGUAGE_NAME[lang]}`];
  if (context?.length) {
    parts.push(["## Context — an earlier question in the same form", ...context.map(block)].join("\n\n"));
  }
  parts.push(["## The question to judge", ...transcript.map(block)].join("\n\n"));
  return parts.join("\n\n");
}

/** Whether a follow-up may be shown. Everything else is logged as "rejected". */
export function postCheck(output: ProbeOutput): boolean {
  if (!output.missing) return false;
  const followUp = output.followUp?.trim() ?? "";
  if (!followUp || followUp.length > MAX_FOLLOWUP_CHARS) return false;
  // Exactly one question, and it is the whole follow-up.
  if (!followUp.endsWith("?") || followUp.split("?").length !== 2) return false;
  return !URL_OR_EMAIL.test(followUp);
}

export const PRIMARY_MODEL = "anthropic/claude-sonnet-5";
export const FALLBACK_MODEL = "anthropic/claude-haiku-4.5";
/** One deadline covers the primary model and the fallback (design §9). */
export const DEADLINE_MS = 8_000;

export type ProbeResult = {
  decision: ProbeDecision;
  /** The model that answered, or the one asked when the call failed. */
  model: string;
  promptVersion: string;
  latencyMs: number;
  followUp?: string;
  reason?: string;
  errorClass?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type ProbeOptions = {
  /** Injected by the tests; production passes nothing and gets the gateway. */
  model?: LanguageModel;
  timeoutMs?: number;
};

/**
 * One model call. Never throws: a failure becomes decision "error" with an
 * error class, and the form carries on without a follow-up.
 */
export async function runProbe(input: ProbeInput, options: ProbeOptions = {}): Promise<ProbeResult> {
  const prompt = loadPrompt(input.question.id);
  const model = options.model ?? PRIMARY_MODEL;
  const started = Date.now();
  try {
    const result = await generateText({
      model,
      instructions: prompt.text,
      prompt: buildPrompt(input),
      output: Output.object({ schema: ProbeOutputSchema }),
      maxRetries: 1,
      timeout: { totalMs: options.timeoutMs ?? DEADLINE_MS },
      providerOptions: {
        gateway: { models: [FALLBACK_MODEL], disallowPromptTraining: true },
      },
    });
    const output = result.output;
    const call = {
      model: result.response.modelId || modelName(model),
      promptVersion: prompt.version,
      latencyMs: Date.now() - started,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      reason: output.reason,
    };
    if (postCheck(output)) {
      return { ...call, decision: "ask", followUp: output.followUp!.trim() };
    }
    return { ...call, decision: output.missing ? "rejected" : "stop" };
  } catch (error) {
    return {
      decision: "error",
      errorClass: classify(error),
      model: modelName(model),
      promptVersion: prompt.version,
      latencyMs: Date.now() - started,
    };
  }
}

function modelName(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

/** Errors the model's answer caused rather than the transport. */
const SCHEMA_ERRORS = new Set([
  "AI_NoOutputGeneratedError",
  "AI_NoObjectGeneratedError",
  "AI_TypeValidationError",
  "AI_JSONParseError",
]);

/** The error and what it wraps: a retry keeps the real cause one level down. */
function* causes(error: unknown): Generator<{ name: string; value: unknown }> {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    yield { name: current.name, value: current };
    current = RetryError.isInstance(current) ? current.lastError : current.cause;
  }
}

function classify(error: unknown): string {
  for (const { name, value } of causes(error)) {
    if (name === "TimeoutError" || name === "AbortError") return "timeout";
    if (APICallError.isInstance(value)) {
      if (value.statusCode === 402) return "budget";
      if (value.statusCode === 429) return "rate_limit";
      return "provider";
    }
    if (SCHEMA_ERRORS.has(name)) return "schema";
  }
  return "provider";
}
