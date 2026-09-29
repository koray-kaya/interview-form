// /admin/results/open — every counted answer to the three open questions,
// each with its AI follow-ups and the model's reasons; anchors #case, #pains
// and #gains for the overview's links. Behind the admin password.
import type { Metadata } from "next";
import { connection } from "next/server";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { OpenAnswer } from "@/components/results/ThreadView";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { firstCode, openAnswers, resultsLang, withLang } from "@/results";

export const metadata: Metadata = { title: "Open answers", robots: { index: false, follow: false } };

export default async function OpenAnswersPage({ searchParams }: { searchParams: Promise<{ l?: string | string[] }> }) {
  await connection();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="open" path="/admin/results/open" lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      <p className="text-sm text-body">Each answer with the AI&apos;s follow-ups. A reason is the model&apos;s own, as given when it was called.</p>
      {openAnswers(FORM, rows).map((section) => (
        <section key={section.question.id} id={section.question.id} className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="mt-4 flex gap-4 text-lg font-semibold text-foreground">
            <span className="tabular-nums text-muted-foreground">{section.number}</span>
            {t(section.question.text, lang)}
          </h2>
          {section.entries.length === 0 && <p className="text-sm text-muted-foreground">No answers yet.</p>}
          {section.entries.map((entry) => (
            <article key={entry.code} className="flex flex-col gap-4 rounded-xl border border-border bg-white/70 p-5 break-inside-avoid">
              <a href={withLang(`/admin/results/${entry.code}`, lang)} className="self-start font-mono text-sm text-accent underline-offset-4 hover:underline">
                {entry.code}
              </a>
              <OpenAnswer question={section.question} value={entry.value} thread={entry.thread} lang={lang} />
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
