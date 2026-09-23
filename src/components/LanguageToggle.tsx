"use client";
// The DE/EN switch, top right. Shown on the welcome screen and on the question
// screens, so a participant who began in the wrong language is not stuck with
// it. Quiet while answering: the same control, without the card around it, so
// it does not compete with the question or invite a stray tap while typing.
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

type Props = {
  lang: Lang;
  onLang: (lang: Lang) => void;
  quiet?: boolean;
};

export function LanguageToggle({ lang, onLang, quiet = false }: Props) {
  return (
    <div
      className={
        "fixed right-5 top-5 z-20 flex text-sm " +
        (quiet ? "gap-1 opacity-60 transition-opacity hover:opacity-100" : "rounded-md border border-border bg-white p-0.5 shadow-sm")
      }
    >
      {(["de", "en"] as Lang[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onLang(option)}
          aria-pressed={lang === option}
          className={
            "rounded px-2.5 py-1 transition-colors " +
            (lang === option
              ? quiet
                ? "font-medium text-accent"
                : "bg-accent font-medium text-white"
              : "text-body hover:text-accent")
          }
        >
          {t(option === "de" ? UI.langDe : UI.langEn, lang)}
        </button>
      ))}
    </div>
  );
}
