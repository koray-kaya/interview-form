"use client";
// Several statements answered on one shared scale (the activities screen).
// Each statement is its own row with its own buttons, stacked, because a grid
// table is harder to answer on a phone (design §2). No letter keys here: with
// five rows they would be ambiguous; Tab moves between buttons, Space chooses,
// and the screen's Enter submits. Plain React state lifted through onChange.
import { useId } from "react";
import type { Option } from "@/form";
import { t, type Lang } from "@/i18n";

type Props = {
  rows: Option[];
  scale: Option[];
  lang: Lang;
  /** Scale point per row id, for the rows answered so far. */
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
};

export function RowsInput({ rows, scale, lang, value, onChange }: Props) {
  const base = useId();
  return (
    <div className="flex w-full flex-col gap-7">
      {rows.map((row) => {
        const labelId = `${base}-${row.id}`;
        return (
          <div key={row.id} role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2.5">
            <p id={labelId} className="text-lg leading-snug text-foreground">{t(row.label, lang)}</p>
            <div className="flex flex-wrap gap-2">
              {scale.map((point) => {
                const on = value[row.id] === point.id;
                return (
                  <button
                    key={point.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange({ ...value, [row.id]: point.id })}
                    className={
                      "rounded-md border px-3 py-2 text-base text-accent transition-colors " +
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                      (on ? "animate-blink border-accent bg-accent/15 font-medium" : "border-accent/30 bg-accent/5 hover:bg-accent/10")
                    }
                  >
                    {t(point.label, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
