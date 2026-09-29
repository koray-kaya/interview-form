// The rows question (statements on one frequency scale): one 100% stacked
// bar per statement in five tints of the accent colour, counts inside the
// segments, one legend, and the same numbers as a table for exact reading.
import { Fragment } from "react";
import type { Option, RowsQuestion } from "@/form";
import { t, type Lang } from "@/i18n";
import { percent, shareLabel, type OptionCount } from "@/results";

const TINTS = [
  "bg-accent/20 text-foreground",
  "bg-accent/40 text-foreground",
  "bg-accent/60 text-white",
  "bg-accent/80 text-white",
  "bg-accent text-white",
];
const tint = (i: number) => TINTS[Math.min(i, TINTS.length - 1)];

export function RowsChart({ question, rows, n, lang }: {
  question: RowsQuestion;
  rows: { row: Option; counts: OptionCount[] }[];
  n: number;
  lang: Lang;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-body">
        {question.scale.map((step, i) => (
          <li key={step.id} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-sm ${tint(i)}`} />
            {t(step.label, lang)}
          </li>
        ))}
      </ul>
      {rows.map(({ row, counts }) => (
        <div key={row.id} className="flex flex-col gap-1.5">
          <span className="text-sm text-body">{t(row.label, lang)}</span>
          <div className="flex h-7 overflow-hidden rounded-md bg-border/70 text-xs tabular-nums">
            {counts.map(({ option, count }, i) =>
              count === 0 ? null : (
                <span
                  key={option.id}
                  title={`${t(option.label, lang)}: ${shareLabel(count, n)}`}
                  className={`flex items-center justify-center ${tint(i)}`}
                  style={{ width: `${percent(count, n)}%` }}
                >
                  {count}
                </span>
              ),
            )}
          </div>
        </div>
      ))}
      <details className="text-sm print:hidden">
        <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal" />
              {question.scale.map((step) => <th key={step.id} className="py-1 text-right font-normal">{t(step.label, lang)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ row, counts }) => (
              <tr key={row.id}>
                <td className="py-1 pr-4 text-body">{t(row.label, lang)}</td>
                {counts.map(({ option, count }) => (
                  <Fragment key={option.id}>
                    <td className="py-1 text-right tabular-nums">{count}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
