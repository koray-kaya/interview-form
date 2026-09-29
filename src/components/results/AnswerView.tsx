// One answer of one response, in the words participants saw: a skipped
// question with the rule that skipped it, a choice, a list of choices, the
// rows question row by row, or an open answer with its thread.
import { Fragment } from "react";
import type { Option } from "@/form";
import { t, type Lang } from "@/i18n";
import { optionOf, type ResponseItem } from "@/results";
import { OpenAnswer } from "./ThreadView";

export function AnswerView({ item, lang }: { item: ResponseItem; lang: Lang }) {
  if (item.state === "skipped") {
    if (!item.because) return <p className="text-sm italic text-muted-foreground">No answer.</p>;
    const label = t(item.because.option.label, lang);
    const why = item.because.kind === "is"
      ? `question ${item.because.number} was answered “${label}”`
      : `every row of question ${item.because.number} was “${label}”`;
    return <p className="text-sm text-muted-foreground"><em>skipped (path)</em>: {why}</p>;
  }
  const { question, value } = item;
  if (question.type === "open") return <OpenAnswer question={question} value={value} thread={item.thread} lang={lang} />;
  if (question.type === "rows" && "rows" in value) {
    return (
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        {question.rows.map((row) => {
          const step = optionOf(question, value.rows[row.id] ?? "");
          return (
            <Fragment key={row.id}>
              <dt className="text-body">{t(row.label, lang)}</dt>
              <dd className="text-foreground">{step ? t(step.label, lang) : "—"}</dd>
            </Fragment>
          );
        })}
      </dl>
    );
  }
  const ids = "option" in value ? [value.option] : "options" in value ? value.options : [];
  const labels = ids
    .map((id) => optionOf(question, id))
    .filter((o): o is Option => o !== undefined)
    .map((o) => t(o.label, lang));
  if (question.type === "multi") {
    return (
      <ul className="list-disc pl-5 text-foreground marker:text-muted-foreground">
        {labels.map((label) => <li key={label}>{label}</li>)}
      </ul>
    );
  }
  return <p className="text-foreground">{labels[0] ?? "—"}</p>;
}
