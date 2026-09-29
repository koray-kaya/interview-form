// An open answer and its follow-ups as a transcript: the answer, each model
// decision with its reason, each reply (design note §5). The AI's questions
// carry the accent colour; stops, rejections and errors are muted. Reasons are
// the model's own, as given at the time of the call.
import type { AnswerValue } from "@/engine";
import type { OpenQuestion } from "@/form";
import { t, type Lang } from "@/i18n";
import { optionOf } from "@/results";
import type { Decision, Thread } from "@/threads";

function Turn({ label, accent = false, muted = false, children }: { label: string; accent?: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className={`pt-0.5 text-xs ${accent ? "font-medium text-accent" : "text-muted-foreground"}`}>{label}</dt>
      <dd className={`border-l-2 pl-4 whitespace-pre-wrap ${accent ? "border-accent" : "border-border"} ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {children}
      </dd>
    </>
  );
}

function DecisionTurn({ index, decision, answered }: { index: number; decision: Decision; answered: boolean }) {
  const earlier = decision.stale ? " (made on an earlier version of the answer)" : "";
  if (decision.decision === "ask") {
    return (
      <Turn label={`AI follow-up ${index}${answered ? " (answered)" : ""}`} accent>
        {decision.followUp}
        <span className="mt-1 block text-xs text-muted-foreground">Why: {decision.reason}{earlier}</span>
      </Turn>
    );
  }
  if (decision.decision === "error") {
    return <Turn label="AI" muted>{`No follow-up — the model call failed (${decision.errorClass ?? "unknown"})${earlier}.`}</Turn>;
  }
  if (decision.decision === "rejected") {
    return <Turn label="AI" muted>{`A follow-up was written but failed the check — ${decision.reason}${earlier}`}</Turn>;
  }
  return <Turn label="AI" muted>{`No further question — ${decision.reason}${earlier}`}</Turn>;
}

export function ThreadView({ text, thread }: { text: string; thread: Thread | null }) {
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 text-sm sm:grid-cols-[7.5rem_1fr]">
      <Turn label="Answer">{text}</Turn>
      {thread?.steps.map((step) => (
        <DecisionsAndReply key={step.index} step={step} />
      ))}
      {thread?.end === "limit" && <Turn label="Rule" muted>{`No further question — the limit of ${thread.max} follow-ups was reached.`}</Turn>}
      {thread?.end === "no-call" && <Turn label="AI" muted>No further model call.</Turn>}
    </dl>
  );
}

function DecisionsAndReply({ step }: { step: Thread["steps"][number] }) {
  const asks = step.decisions.filter((d) => d.decision === "ask").length;
  return (
    <>
      {step.decisions.map((decision, i) => {
        const answered = asks > 1 && decision.decision === "ask" && step.reply !== null && decision.followUp === step.reply.question;
        return <DecisionTurn key={i} index={step.index} decision={decision} answered={answered} />;
      })}
      {step.reply && <Turn label={`Reply ${step.index}`}>{step.reply.text}</Turn>}
    </>
  );
}

/** A written answer with its thread, or the escape option it chose. */
export function OpenAnswer({ question, value, thread, lang }: { question: OpenQuestion; value: AnswerValue; thread: Thread | null; lang: Lang }) {
  if ("text" in value) return <ThreadView text={value.text} thread={thread} />;
  const option = "option" in value ? optionOf(question, value.option) : undefined;
  return <p className="text-sm text-muted-foreground">Chose “{option ? t(option.label, lang) : "—"}”; no follow-up is asked.</p>;
}
