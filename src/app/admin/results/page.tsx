// /admin/results — the overview: tiles, then the fourteen questions in form
// order; bars for the closed ones, a summary card linking to the answers for
// the open ones. Behind the admin password (src/proxy.ts), rendered on every
// request. Design: docs/design/2026-09-28-results-dashboard.md.
import type { Metadata } from "next";
import { connection } from "next/server";
import { ResultCard } from "@/components/results/ResultCard";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { Tile } from "@/components/Tile";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { firstCode, questionResults, resultsLang, tiles } from "@/results";

export const metadata: Metadata = { title: "Results", robots: { index: false, follow: false } };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ l?: string | string[] }> }) {
  await connection();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);
  const s = tiles(FORM, rows);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="overview" path="/admin/results" lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Completed" value={s.completed} />
        <Tile label="Median time" value={s.medianMinutes === null ? "–" : `${Math.round(s.medianMinutes)} min`} />
        <Tile label="Follow-ups asked" value={s.followUps} />
        <Tile label="Model calls" value={s.calls} hint={`${s.stops} stops, ${s.errors} errors or rejected`} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Questions</h2>
      {questionResults(FORM, rows).map((result) => (
        <ResultCard key={result.question.id} result={result} lang={lang} />
      ))}
    </main>
  );
}
