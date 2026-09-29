// /admin — Koray's page, behind the password in src/proxy.ts: how many
// responses there are, the invitation link maker, and the way to the results
// (/admin/results, which shows answers by reference code). This page shows
// no answer text and no company number. Rendered on every request (the
// numbers change), never cached, never indexed.
import type { Metadata } from "next";
import { connection } from "next/server";
import { LinkMaker } from "@/components/LinkMaker";
import { Tile } from "@/components/Tile";
import { readStats } from "@/db";
import { FORM_VERSION } from "@/form";
import { summarize } from "@/stats";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  await connection();
  const { responses, calls } = await readStats();
  const s = summarize(responses, calls, FORM_VERSION, new Date());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Survey — form {FORM_VERSION}</h1>
        <p className="text-sm text-body">Counts without the smoke test. Unfinished answers are deleted after seven days.</p>
      </header>

      <a href="/admin/results" className="self-start text-sm font-medium text-accent underline-offset-4 hover:underline">
        Read the results →
      </a>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Completed" value={s.completed} />
        <Tile label="In progress" value={s.unfinished} />
        <Tile label="Completed today" value={s.completedToday} />
        <Tile label="Last 7 days" value={s.completedLast7Days} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Median time" value={s.medianMinutes === null ? "–" : `${s.medianMinutes} min`} />
        <Tile label="Language" value={`${s.byLang.de} DE · ${s.byLang.en} EN`} />
        <Tile label="Link" value={`${s.byLink.uid} · ${s.byLink.personal} · ${s.byLink.none}`} hint="company number · personal code · none" />
      </div>

      <p className="text-sm text-body">
        AI follow-ups: {s.calls.total} model calls, {s.calls.asked} questions asked, {s.calls.errors} errors.
      </p>

      <LinkMaker />
    </main>
  );
}
