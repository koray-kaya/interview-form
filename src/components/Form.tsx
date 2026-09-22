"use client";
// Placeholder until Task 8: shows the title and intro in the chosen language
// so the theme and ?l= can be checked in the browser.
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

export function Form({ initialLang }: { initialLang: Lang }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-normal leading-tight">{t(UI.title, initialLang)}</h1>
      <p className="text-lg">{t(UI.intro, initialLang)}</p>
      <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{t(UI.privacy, initialLang)}</p>
    </main>
  );
}
