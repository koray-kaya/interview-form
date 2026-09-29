// /admin/results/<code> — one response by its reference code: every
// question in form order with the answer in words, the skipped ones with
// the rule that skipped them, open answers with their threads. No company
// number, no e-mail address (those are on the Contacts page only). A code
// that is not eight lowercase hex characters gives 404 before the database
// is read.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AnswerView } from "@/components/results/AnswerView";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { firstCode, responseView, resultsLang, withLang } from "@/results";

export const metadata: Metadata = { title: "Response", robots: { index: false, follow: false } };

const CODE = /^[0-9a-f]{8}$/;

export default async function ResponsePage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ l?: string | string[] }>;
}) {
  await connection();
  const { code } = await params;
  if (!CODE.test(code)) notFound();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);
  const view = responseView(FORM, rows, code);
  if (!view) notFound();

  const nav = (
    <nav className="flex items-center justify-between text-sm print:hidden">
      <span className="text-muted-foreground">Response {view.position} of {view.total}</span>
      <span className="flex gap-4">
        {view.previous && <a href={withLang(`/admin/results/${view.previous}`, lang)} className="text-accent hover:underline">← previous</a>}
        {view.next && <a href={withLang(`/admin/results/${view.next}`, lang)} className="text-accent hover:underline">next →</a>}
      </span>
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="responses" path={`/admin/results/${code}`} lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      {nav}
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-foreground">Response {view.code}</h2>
        <dl className="flex gap-8 text-sm">
          <div><dt className="text-muted-foreground">Language</dt><dd className="text-foreground">{view.lang === "de" ? "German" : "English"}</dd></div>
          <div><dt className="text-muted-foreground">Time taken</dt><dd className="text-foreground">{view.minutes} min</dd></div>
          <div><dt className="text-muted-foreground">AI follow-ups</dt><dd className="text-foreground">{view.followUps}</dd></div>
        </dl>
      </div>
      <ol className="flex flex-col divide-y divide-border border-t border-border">
        {view.items.map((item) => (
          <li key={item.question.id} className="grid grid-cols-[1.75rem_1fr] gap-x-4 py-5 break-inside-avoid sm:grid-cols-[2.5rem_1fr]">
            <span className="text-sm tabular-nums text-muted-foreground">{item.number}</span>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-body">{t(item.question.text, lang)}</p>
              <AnswerView item={item} lang={lang} />
            </div>
          </li>
        ))}
      </ol>
      {nav}
    </main>
  );
}
