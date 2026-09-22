"use client";
// A list of options rendered as buttons with key hints (A, B, C …), like
// Typeform. Single choice replaces the selection; multi choice toggles; an
// "exclusive" option (none of these / neither) clears the others. Plain React
// state lifted to the parent through onChange.
import { useEffect } from "react";
import type { Option } from "@/form";
import { t, type Lang } from "@/i18n";

const KEYS = "ABCDEFGHIJ";

type Props = {
  options: Option[];
  lang: Lang;
  multiple: boolean;
  exclusive?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function ChoiceInput({ options, lang, multiple, exclusive, selected, onChange }: Props) {
  function toggle(id: string) {
    if (!multiple) return onChange([id]);
    if (selected.includes(id)) return onChange(selected.filter((x) => x !== id));
    if (id === exclusive) return onChange([id]);
    onChange([...selected.filter((x) => x !== exclusive), id]);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return; // shortcuts such as Cmd+C
      const index = KEYS.indexOf(event.key.toUpperCase());
      if (index >= 0 && index < options.length) toggle(options[index].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div role={multiple ? "group" : "radiogroup"} className="flex flex-col gap-2">
      {options.map((option, index) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => toggle(option.id)}
            className={
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-lg transition-colors " +
              (on ? "border-accent bg-accent/10" : "border-border bg-input hover:border-accent")
            }
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-background text-xs font-medium">
              {KEYS[index]}
            </span>
            {t(option.label, lang)}
          </button>
        );
      })}
    </div>
  );
}
