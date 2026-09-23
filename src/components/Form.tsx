"use client";
// The orchestrator. Holds the stage (welcome → questions → done), the
// answers and the language; asks the engine which question comes next. The
// server is the record: Start creates a response, every OK stores the answer
// before the form moves on, the last one completes the response. A refresh
// resumes from the server; localStorage only remembers the response id.
// Keyboard: ArrowUp goes back.
import { useEffect, useState, useSyncExternalStore } from "react";
import { ApiError, completeResponse, fetchResponse, postAnswer, startResponse, type AskedFollowUp } from "@/api";
import { FORM, FORM_VERSION } from "@/form";
import {
  AnswerValueSchema, activeQuestions, applyAnswer, nextQuestion, previousQuestion, progress, pruneSkipped,
  questionAfter, questionNumber, type Answers, type AnswerValue,
} from "@/engine";
import { t, type Lang } from "@/i18n";
import { referenceCode as codeFor } from "@/responses";
import { clearSaved, loadSaved, saveSaved, type Stage } from "@/storage";
import { UI } from "@/texts";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionScreen } from "@/components/QuestionScreen";
import { ThankYou } from "@/components/ThankYou";
import { Welcome } from "@/components/Welcome";

type Props = { initialLang: Lang; companyTag?: string };

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
export function Form(props: Props) {
  return useInBrowser() ? <FormInBrowser {...props} /> : <main />;
}

const written = (value: AnswerValue): string => ("text" in value ? value.text : "");

function wantsConversation(answers: Answers): boolean {
  const value = answers.followup;
  return value !== undefined && "options" in value && value.options.includes("conversation");
}

// Where a resumed participant continues: the first unanswered question, or,
// when all are answered but the form was not completed, the last one.
function resumeAt(answers: Answers): string | null {
  const active = activeQuestions(FORM, answers);
  return (nextQuestion(FORM, answers) ?? active[active.length - 1])?.id ?? null;
}

function FormInBrowser({ initialLang, companyTag }: Props) {
  // read localStorage once, on the first render (the function form of useState)
  const [saved] = useState(() => loadSaved());
  const resuming = saved?.stage === "questions" && saved.responseId !== null;

  const [lang, setLang] = useState<Lang>(saved?.lang ?? initialLang);
  const [stage, setStage] = useState<Stage | "loading">(resuming ? "loading" : (saved?.stage ?? "welcome"));
  const [responseId, setResponseId] = useState<string | null>(saved?.responseId ?? null);
  const [answers, setAnswers] = useState<Answers>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | undefined>(saved?.referenceCode);
  const [inTouch, setInTouch] = useState<boolean>(saved?.inTouch ?? false);
  // which way the last move went, so the next screen slides in from there
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  // the model's open follow-up, and what the participant already wrote here
  const [followUp, setFollowUp] = useState<AskedFollowUp | null>(null);
  const [given, setGiven] = useState<{ question?: string; answer: string }[]>([]);

  // Resume from the server once. A response it no longer knows (deleted
  // after seven days, or from an older form) starts over.
  useEffect(() => {
    if (!resuming || !saved?.responseId) return;
    const id = saved.responseId;
    let cancelled = false;
    fetchResponse(id)
      .then((resumed) => {
        if (cancelled) return;
        if (!resumed || resumed.formVersion !== FORM_VERSION) {
          clearSaved();
          setResponseId(null);
          setStage("welcome");
          return;
        }
        const restored: Answers = {};
        for (const row of resumed.answered) {
          const value = AnswerValueSchema.safeParse(row.value);
          if (row.followupIndex === 0 && value.success) restored[row.questionId] = value.data;
        }
        const clean = pruneSkipped(FORM, restored);
        setLang(resumed.lang);
        setAnswers(clean);
        const waiting = resumed.pending[0];
        if (!resumed.completed && waiting) {
          // the participant left with a follow-up on screen: show it again,
          // with everything they already wrote on this question above it
          setCurrentId(waiting.questionId);
          setFollowUp({ index: waiting.index, text: waiting.text });
          setGiven([
            { answer: written(clean[waiting.questionId] ?? { text: "" }) },
            ...resumed.answered
              .filter((row) => row.questionId === waiting.questionId && row.followupIndex > 0)
              .sort((a, b) => a.followupIndex - b.followupIndex)
              .map((row) => ({ question: row.questionText, answer: written(row.value) })),
          ]);
          setStage("questions");
          return;
        }
        if (resumed.completed) {
          setReferenceCode(codeFor(id));
          setInTouch(wantsConversation(clean));
          setStage("done");
        } else {
          setCurrentId(resumeAt(clean));
          setStage("questions");
        }
      })
      .catch(() => {
        if (!cancelled) setStage("welcome");
      });
    return () => {
      cancelled = true;
    };
  }, [resuming, saved]);

  useEffect(() => {
    if (stage === "loading") return;
    saveSaved({ version: FORM_VERSION, lang, stage, responseId, referenceCode, inTouch });
  }, [lang, stage, responseId, referenceCode, inTouch]);

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

  // Returns an error message for the welcome screen, or null on success.
  async function begin(): Promise<string | null> {
    try {
      const { id } = await startResponse({ c: companyTag, lang });
      setResponseId(id);
      setCurrentId(nextQuestion(FORM, {})?.id ?? null);
      setDirection("forward");
      setStage("questions");
      return null;
    } catch {
      return t(UI.startFailed, lang);
    }
  }

  // Stores the answer. The server may answer with a follow-up, and then the
  // form stays on this question. Returns an error message for the question
  // screen, or null.
  async function submit(value: AnswerValue): Promise<string | null> {
    if (!current || !responseId) return null;
    let asked: AskedFollowUp | null = null;
    try {
      asked = (await postAnswer(responseId, current.id, value, lang)).followUp;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) return error.message;
      return t(UI.saveFailed, lang);
    }

    // applyAnswer cleans the value and drops answers the new one skips, as
    // the server just did
    const updated = applyAnswer(FORM, answers, current.id, value);
    setAnswers(updated);
    if (asked) {
      setGiven([{ answer: written(value) }]);
      setFollowUp(asked);
      return null;
    }
    return await moveOn(updated);
  }

  /** The answer to the model's follow-up. It may earn one more, then the form moves on. */
  async function submitFollowUp(value: AnswerValue): Promise<string | null> {
    if (!current || !responseId || !followUp) return null;
    let asked: AskedFollowUp | null = null;
    try {
      asked = (await postAnswer(responseId, current.id, value, lang, followUp.index)).followUp;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) return error.message;
      return t(UI.saveFailed, lang);
    }
    setGiven([...given, { question: followUp.text, answer: written(value) }]);
    setFollowUp(asked);
    return asked ? null : await moveOn(answers);
  }

  async function moveOn(updated: Answers): Promise<string | null> {
    if (!current || !responseId) return null;
    setFollowUp(null);
    setGiven([]);
    setDirection("forward");
    // walk forward screen by screen (also after Back); at the end, pick up
    // anything a changed answer un-skipped
    const next = questionAfter(FORM, updated, current.id) ?? nextQuestion(FORM, updated);
    if (next) {
      setCurrentId(next.id);
      return null;
    }

    try {
      const result = await completeResponse(responseId);
      setReferenceCode(result.referenceCode);
      setInTouch(wantsConversation(updated));
      setStage("done");
      return null;
    } catch {
      return t(UI.saveFailed, lang);
    }
  }

  if (stage === "loading") return <main />;
  if (stage === "welcome") return <main><Welcome lang={lang} onLang={setLang} onStart={begin} /></main>;
  if (stage === "done" || !current) {
    return <main><ThankYou lang={lang} referenceCode={referenceCode} inTouch={inTouch} /></main>;
  }

  const { done, total } = progress(FORM, answers);

  return (
    <main>
      <ProgressBar done={done} total={total} />
      <LanguageToggle lang={lang} onLang={setLang} quiet />
      <QuestionScreen
        // a new follow-up is a new screen: the key resets the draft in the box
        key={`${current.id}:${followUp?.index ?? 0}`}
        question={current}
        lang={lang}
        number={questionNumber(FORM, answers, current.id)}
        initial={answers[current.id]}
        onSubmit={submit}
        onBack={followUp ? undefined : previousQuestion(FORM, answers, current.id) ? goBack : undefined}
        direction={direction}
        asking={followUp?.text}
        given={given}
        onFollowUp={submitFollowUp}
      />
    </main>
  );
}
