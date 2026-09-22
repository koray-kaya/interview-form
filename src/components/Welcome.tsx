"use client";
// The first screen: title, study text, privacy text, language toggle, the
// consent checkbox and Start. Start stays disabled until the box is ticked.
import { useState } from "react";
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

type Props = { lang: Lang; onLang: (lang: Lang) => void; onStart: () => void };

export function Welcome({ lang, onLang, onStart }: Props) {
  const [agreed, setAgreed] = useState(false);
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <div className="flex justify-end gap-2 text-sm">
        {(["de", "en"] as Lang[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onLang(option)}
            aria-pressed={lang === option}
            className={"rounded px-2 py-1 " + (lang === option ? "bg-muted font-medium" : "text-muted-foreground hover:underline")}
          >
            {t(option === "de" ? UI.langDe : UI.langEn, lang)}
          </button>
        ))}
      </div>
      <h1 className="text-3xl font-normal leading-tight">{t(UI.title, lang)}</h1>
      <p className="text-lg">{t(UI.intro, lang)}</p>
      <p className="text-muted-foreground">{t(UI.privacy, lang)}</p>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 h-5 w-5 accent-accent" />
        <span>{t(UI.consent, lang)}</span>
      </label>
      <div>
        <button
          type="button"
          disabled={!agreed}
          onClick={onStart}
          className="rounded-lg bg-foreground px-5 py-2.5 text-lg font-medium text-background hover:opacity-90 disabled:opacity-40"
        >
          {t(UI.start, lang)}
        </button>
      </div>
    </section>
  );
}
