// /admin/results/contacts — the people who asked to be contacted, with their
// link's tag (company number or personal code) and e-mail address. The only
// results page that shows either, and it is not printed (design note §2).
import type { Metadata } from "next";
import { connection } from "next/server";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { contacts } from "@/contacts";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { firstCode, resultsLang, withLang } from "@/results";

export const metadata: Metadata = { title: "Contacts", robots: { index: false, follow: false } };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ l?: string | string[] }> }) {
  await connection();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);
  const list = contacts(FORM, rows.responses, rows.answers);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="contacts" path="/admin/results/contacts" lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      <p className="hidden text-sm text-body print:block">The contacts list is not printed.</p>
      <div className="flex flex-col gap-4 print:hidden">
        <p className="text-sm text-body">
          Only the people who asked to be contacted. Their company number and e-mail address appear nowhere else in these pages.
        </p>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-normal">Response</th>
                  <th className="py-2 pr-4 font-normal">Link</th>
                  <th className="py-2 pr-4 font-normal">E-mail</th>
                  <th className="py-2 pr-4 font-normal">Open to</th>
                  <th className="py-2 font-normal">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((c) => (
                  <tr key={c.code}>
                    <td className="py-2 pr-4">
                      <a href={withLang(`/admin/results/${c.code}`, lang)} className="font-mono text-accent hover:underline">{c.code}</a>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{c.tag ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {c.email ? <a href={`mailto:${c.email}`} className="text-accent hover:underline">{c.email}</a> : "—"}
                    </td>
                    <td className="py-2 pr-4">{c.openTo.map((o) => t(o.label, lang)).join(", ")}</td>
                    <td className="py-2 tabular-nums">{new Date(c.completedAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
