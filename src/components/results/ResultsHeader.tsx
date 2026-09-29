// The top of every results page: the title, when the rows were read, the
// tabs, and the switch between English and German question texts. The tabs
// are plain links (each page is its own request); none of them is printed.
import { FORM_VERSION } from "@/form";
import type { Lang } from "@/i18n";
import { withLang } from "@/results";

export type Tab = "overview" | "open" | "responses" | "contacts";

type Props = { tab: Tab; path: string; lang: Lang; first: string | null; asOf: Date };

export function ResultsHeader({ tab, path, lang, first, asOf }: Props) {
  const tabs: { id: Tab; label: string; href: string | null }[] = [
    { id: "overview", label: "Overview", href: "/admin/results" },
    { id: "open", label: "Open answers", href: "/admin/results/open" },
    { id: "responses", label: "Responses", href: first ? `/admin/results/${first}` : null },
    { id: "contacts", label: "Contacts", href: "/admin/results/contacts" },
  ];
  const time = asOf.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "medium", timeStyle: "short" });
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Survey results — form {FORM_VERSION}</h1>
        <p className="text-sm text-body">As of {time}. Completed responses only.</p>
      </div>
      <nav aria-label="Results" className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-border text-sm print:hidden">
        {tabs.map((item) =>
          item.href === null ? null : (
            <a
              key={item.id}
              href={withLang(item.href, lang)}
              aria-current={item.id === tab ? "page" : undefined}
              className={item.id === tab ? "-mb-px border-b-2 border-accent pb-2 text-foreground" : "pb-2 text-body hover:text-foreground"}
            >
              {item.label}
            </a>
          ),
        )}
        <a href={withLang(path, lang === "de" ? "en" : "de")} className="ml-auto pb-2 text-muted-foreground hover:text-foreground">
          {lang === "de" ? "Question texts in English" : "Question texts in German"}
        </a>
      </nav>
    </header>
  );
}
