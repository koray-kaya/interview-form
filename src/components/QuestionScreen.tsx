"use client";
// One question on one screen: number, title, helper line, the right input for
// the question type, the validation error, OK, and the up/down buttons in the
// corner. Holds the draft answer locally; hands a valid AnswerValue up through
// onSubmit. Slides in from below, or from above after Back.
import { useEffect, useState } from "react";
import type { Question } from "@/form";
import { cleanAnswer, validate, wantsEmail, type AnswerValue } from "@/engine";
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";
import { ChoiceInput } from "@/components/ChoiceInput";
import { TextInput } from "@/components/TextInput";
import { ArrowRight, Check, ChevronDown, ChevronUp } from "@/components/icons";

type Props = {
  question: Question;
  lang: Lang;
  number: number;
  initial?: AnswerValue;
  onSubmit: (value: AnswerValue) => void;
  onBack?: () => void;
  /** Which way the participant moved to get here; sets the slide direction. */
  direction?: "forward" | "back";
};

function initialSelected(initial?: AnswerValue): string[] {
  if (!initial) return [];
  if ("option" in initial) return [initial.option];
  if ("options" in initial) return initial.options;
  return [];
}

export function QuestionScreen({ question, lang, number, initial, onSubmit, onBack, direction = "forward" }: Props) {
  const [text, setText] = useState(initial && "text" in initial ? initial.text : "");
  const [selected, setSelected] = useState<string[]>(initialSelected(initial));
  const [email, setEmail] = useState(initial && "email" in initial ? (initial.email ?? "") : "");
  const [error, setError] = useState<string | null>(null);

  function draft(): AnswerValue {
    if (question.type === "open") return { text: text.trim() };
    if (question.type === "single") return selected.length ? { option: selected[0] } : { options: [] };
    // cleanAnswer drops an e-mail the chosen options do not need
    return cleanAnswer(question, { options: selected, email });
  }

  function submit() {
    const value = draft();
    const problem = validate(question, value, lang);
    setError(problem);
    if (!problem) onSubmit(value);
  }

  const showEmail = wantsEmail(question, selected);

  // Enter submits a choice question from anywhere on the page. Text areas and
  // the e-mail field handle Enter themselves. preventDefault stops the focused
  // option button from also toggling on the same key press.
  useEffect(() => {
    if (question.type === "open") return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      submit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section
      className={
        "mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-6 pb-28 pt-16 " +
        (direction === "back" ? "animate-enter-down" : "animate-enter-up")
      }
    >
      <div className="flex gap-3">
        <span className="mt-1.5 flex shrink-0 items-center gap-1 self-start text-base font-medium text-accent sm:mt-2">
          {number}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <div>
            <h1 className="text-2xl leading-snug text-foreground sm:text-[1.75rem]">{t(question.text, lang)}</h1>
            {question.help && <p className="mt-2 text-lg text-body">{t(question.help, lang)}</p>}
          </div>

          {question.type === "open" ? (
            <TextInput value={text} maxChars={question.maxChars} lang={lang} onChange={setText} onSubmit={submit} />
          ) : (
            <ChoiceInput
              options={question.options}
              lang={lang}
              multiple={question.type === "multi"}
              exclusive={question.type === "multi" ? question.exclusive : undefined}
              selected={selected}
              onChange={setSelected}
            />
          )}

          {showEmail && question.type === "multi" && question.email && (
            <label className="flex max-w-md flex-col gap-2">
              <span className="text-lg text-foreground">{t(question.email.label, lang)}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                placeholder={t(UI.emailPlaceholder, lang)}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
                }}
                className="border-0 border-b-2 border-accent/30 bg-transparent pb-2 text-xl text-accent outline-none transition-colors placeholder:text-accent/35 focus:border-accent"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="self-start rounded-md bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={submit}
              className="flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-lg font-semibold text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
            >
              {t(UI.ok, lang)}
              <Check className="h-4 w-4" />
            </button>
            {question.type !== "open" && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{t(UI.pressEnter, lang)}</span>
            )}
          </div>
        </div>
      </div>

      <nav className="fixed bottom-5 right-5 flex overflow-hidden rounded-md shadow-md">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label={t(UI.back, lang)}
          className="bg-accent p-2.5 text-white transition hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={submit}
          aria-label={t(UI.next, lang)}
          className="border-l border-white/20 bg-accent p-2.5 text-white transition hover:bg-accent-hover"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </nav>
    </section>
  );
}
