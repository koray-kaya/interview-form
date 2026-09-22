"use client";
// One question on one screen: number, title, helper line, the right input for
// the question type, the validation error, Back and OK. Holds the draft
// answer locally; hands a valid AnswerValue up through onSubmit.
import { useEffect, useState } from "react";
import type { Question } from "@/form";
import { cleanAnswer, validate, wantsEmail, type AnswerValue } from "@/engine";
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";
import { ChoiceInput } from "@/components/ChoiceInput";
import { TextInput } from "@/components/TextInput";

type Props = {
  question: Question;
  lang: Lang;
  number: number;
  initial?: AnswerValue;
  onSubmit: (value: AnswerValue) => void;
  onBack?: () => void;
};

function initialSelected(initial?: AnswerValue): string[] {
  if (!initial) return [];
  if ("option" in initial) return [initial.option];
  if ("options" in initial) return initial.options;
  return [];
}

export function QuestionScreen({ question, lang, number, initial, onSubmit, onBack }: Props) {
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
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <header className="flex items-start gap-3">
        <span className="mt-1 rounded bg-foreground px-2 py-0.5 text-xs font-medium text-background">{number}</span>
        <div>
          <h1 className="text-2xl font-normal leading-snug">{t(question.text, lang)}</h1>
          {question.help && <p className="mt-2 text-muted-foreground">{t(question.help, lang)}</p>}
        </div>
      </header>

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
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t(question.email.label, lang)}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
            }}
            className="rounded-lg border border-border bg-input p-3 text-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} className="rounded-lg bg-foreground px-5 py-2.5 text-lg font-medium text-background hover:opacity-90">
          {t(UI.ok, lang)}
        </button>
        {onBack && (
          <button type="button" onClick={onBack} className="text-muted-foreground underline-offset-4 hover:underline">
            {t(UI.back, lang)}
          </button>
        )}
      </div>
    </section>
  );
}
