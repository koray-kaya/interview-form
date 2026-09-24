// A rough guess at the language of one short follow-up question, for the
// prompt evals: counts common German and English words. Good enough to catch
// a follow-up in the wrong language; not a language detector. Words that
// start or end with an umlaut are left out: JavaScript's \b does not see them.
import type { Lang } from "@/i18n";

const GERMAN = /\b(sie|ihnen|ihre?[mnrs]?|haben|hatten|hätten|welche[mnrs]?|wie|wo|wer|nicht|und|der|die|das|dabei|genau|bei)\b/gi;
const ENGLISH = /\b(you|your|what|how|which|where|who|whom|did|the|and|would|with)\b/gi;

export function languageOf(text: string): Lang | "unclear" {
  const german = text.match(GERMAN)?.length ?? 0;
  const english = text.match(ENGLISH)?.length ?? 0;
  if (german > english) return "de";
  if (english > german) return "en";
  return "unclear";
}
