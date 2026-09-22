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
    <section className="mx-auto flex min-h-dvh w-full max-w-2xl animate-enter-up flex-col justify-center gap-6 px-6 py-20">
      <div className="fixed right-5 top-5 flex rounded-md border border-border bg-white p-0.5 text-sm shadow-sm">
        {(["de", "en"] as Lang[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onLang(option)}
            aria-pressed={lang === option}
            className={
              "rounded px-2.5 py-1 transition-colors " +
              (lang === option ? "bg-accent font-medium text-white" : "text-body hover:text-accent")
            }
          >
            {t(option === "de" ? UI.langDe : UI.langEn, lang)}
          </button>
        ))}
      </div>

      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">{t(UI.title, lang)}</h1>
      <p className="text-lg leading-relaxed text-body">{t(UI.intro, lang)}</p>
      <p className="rounded-xl border border-border bg-white/70 p-5 text-[0.95rem] leading-relaxed text-body">{t(UI.privacy, lang)}</p>

      <label className="flex cursor-pointer items-start gap-3 text-lg text-foreground">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-accent"
        />
        <span>{t(UI.consent, lang)}</span>
      </label>

      <div>
        <button
          type="button"
          disabled={!agreed}
          onClick={onStart}
          className="rounded-md bg-accent px-7 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {t(UI.start, lang)}
        </button>
      </div>
    </section>
  );
}
