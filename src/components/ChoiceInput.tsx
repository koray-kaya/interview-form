"use client";
// A list of options rendered as buttons with key hints (A, B, C …), like
// Typeform: a chosen option fills its key badge, shows a tick and blinks. Single choice replaces the selection; multi choice toggles; an
// "exclusive" option (none of these / neither) clears the others. Plain React
// state lifted to the parent through onChange.
import { useEffect } from "react";
import type { Option } from "@/form";
import { t, type Lang } from "@/i18n";
import { Check } from "@/components/icons";

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
    <div role={multiple ? "group" : "radiogroup"} className="flex w-full max-w-md flex-col gap-2">
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
              "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-lg text-accent transition-colors " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (on ? "animate-blink border-accent bg-accent/15" : "border-accent/30 bg-accent/5 hover:bg-accent/10")
            }
          >
            <span
              className={
                "flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-semibold transition-colors " +
                (on ? "border-accent bg-accent text-white" : "border-accent/40 bg-white text-accent")
              }
            >
              {KEYS[index]}
            </span>
            <span className="flex-1">{t(option.label, lang)}</span>
            {on && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
