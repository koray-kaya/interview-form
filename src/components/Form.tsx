"use client";
// The orchestrator. Holds the stage (welcome → questions → done), the
// answers and the language; asks the engine which question comes next;
// mirrors everything to localStorage so a refresh resumes. Keyboard: ArrowUp
// goes back. No network in M1 — M2 adds the server calls here.
import { useEffect, useState, useSyncExternalStore } from "react";
import { FORM, FORM_VERSION } from "@/form";
import {
  applyAnswer, nextQuestion, previousQuestion, progress, pruneSkipped, questionAfter, questionNumber,
  type Answers, type AnswerValue,
} from "@/engine";
import type { Lang } from "@/i18n";
import { loadSaved, saveSaved, type Stage } from "@/storage";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionScreen } from "@/components/QuestionScreen";
import { ThankYou } from "@/components/ThankYou";
import { Welcome } from "@/components/Welcome";

type Props = { initialLang: Lang };

// true in the browser, false while Next.js renders the page on the server
const noSubscription = () => () => {};
function useInBrowser(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/**
 * The server sends an empty page; the form itself is built only in the
 * browser, because its first state comes from localStorage, which the server
 * does not have.
 */
export function Form({ initialLang }: Props) {
  return useInBrowser() ? <FormInBrowser initialLang={initialLang} /> : <main />;
}

type Start = { lang: Lang; stage: Stage; answers: Answers; currentId: string | null };

// Where to begin: the saved state if there is one, else the welcome screen.
function restore(initialLang: Lang): Start {
  const saved = loadSaved();
  if (!saved) return { lang: initialLang, stage: "welcome", answers: {}, currentId: null };
  const answers = pruneSkipped(FORM, saved.answers); // never trust stored state blindly
  const currentId = saved.stage === "questions" ? (nextQuestion(FORM, answers)?.id ?? null) : null;
  return { lang: saved.lang, stage: saved.stage, answers, currentId };
}

function FormInBrowser({ initialLang }: Props) {
  // read localStorage once, on the first render (the function form of useState)
  const [start] = useState(() => restore(initialLang));
  const [lang, setLang] = useState<Lang>(start.lang);
  const [stage, setStage] = useState<Stage>(start.stage);
  const [answers, setAnswers] = useState<Answers>(start.answers);
  const [currentId, setCurrentId] = useState<string | null>(start.currentId);
  // which way the last move went, so the next screen slides in from there
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  useEffect(() => {
    saveSaved({ version: FORM_VERSION, lang, stage, answers });
  }, [lang, stage, answers]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const current = currentId ? FORM.questions.find((q) => q.id === currentId) ?? null : null;

  function goBack() {
    if (!currentId) return;
    const previous = previousQuestion(FORM, answers, currentId);
    if (!previous) return;
    setDirection("back");
    setCurrentId(previous.id);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowUp" || stage !== "questions") return;
      // inside a text answer or the e-mail field, ArrowUp moves the cursor
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      goBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function begin() {
    setStage("questions");
    setCurrentId(nextQuestion(FORM, answers)?.id ?? null);
  }

  function submit(value: AnswerValue) {
    if (!current) return;
    // applyAnswer cleans the value and drops answers the new one skips
    const updated = applyAnswer(FORM, answers, current.id, value);
    setAnswers(updated);
    setDirection("forward");
    // walk forward screen by screen (also after Back); at the end, pick up
    // anything a changed answer un-skipped
    const next = questionAfter(FORM, updated, current.id) ?? nextQuestion(FORM, updated);
    if (next) setCurrentId(next.id);
    else setStage("done");
  }

  if (stage === "welcome") return <main><Welcome lang={lang} onLang={setLang} onStart={begin} /></main>;
  if (stage === "done" || !current) return <main><ThankYou lang={lang} /></main>;

  const { done, total } = progress(FORM, answers);

  return (
    <main>
      <ProgressBar done={done} total={total} />
      <QuestionScreen
        key={current.id}
        question={current}
        lang={lang}
        number={questionNumber(FORM, answers, current.id)}
        initial={answers[current.id]}
        onSubmit={submit}
        onBack={previousQuestion(FORM, answers, current.id) ? goBack : undefined}
        direction={direction}
      />
    </main>
  );
}
