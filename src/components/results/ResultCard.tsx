// One question of the overview, whatever its type: bars for single and
// multiple choice, stacked bars for the rows question, and for an open
// question a summary card that links to its answers.
import { t, type Lang } from "@/i18n";
import { withLang, type QuestionResult } from "@/results";
import { OptionBars } from "./OptionBars";
import { QuestionCard } from "./QuestionCard";
import { RowsChart } from "./RowsChart";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The open card's summary line ("2 answered · 1 chose …"), shared with the Open answers page. */
export function openSummary(result: Extract<QuestionResult, { type: "open" }>, lang: Lang): string {
  const escape = result.question.escape;
  const parts = [`${result.written} answered`];
  if (escape) parts.push(`${result.escaped} chose “${t(escape.label, lang)}”`);
  parts.push(`${result.followedUp} got an AI follow-up (${result.followUps} in all)`);
  return parts.join(" · ");
}

export function ResultCard({ result, lang }: { result: QuestionResult; lang: Lang }) {
  const text = t(result.question.text, lang);
  if (result.type === "rows") {
    return (
      <QuestionCard number={result.number} text={text} n={result.n}>
        <RowsChart question={result.question} rows={result.rows} n={result.n} lang={lang} />
      </QuestionCard>
    );
  }
  if (result.type === "open") {
    return (
      <a href={`${withLang("/admin/results/open", lang)}#${result.question.id}`} className="block rounded-xl hover:[&>section]:border-accent/40">
        <QuestionCard number={result.number} text={text} n={result.n}>
          <p className="text-sm text-body">{openSummary(result, lang)}</p>
          <span className="text-sm font-medium text-accent">Read the {plural(result.written, "answer")} and the AI follow-ups →</span>
        </QuestionCard>
      </a>
    );
  }
  return (
    <QuestionCard number={result.number} text={text} n={result.n} note={result.type === "multi" ? "Several answers possible; shares are of n." : undefined}>
      <OptionBars counts={result.counts} n={result.n} lang={lang} />
    </QuestionCard>
  );
}
