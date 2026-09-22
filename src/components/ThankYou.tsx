// The last screen. M2 adds the reference code and the contact line.
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";
import { Check } from "@/components/icons";

export function ThankYou({ lang }: { lang: Lang }) {
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-2xl animate-enter-up flex-col justify-center gap-4 px-6 py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-md">
        <Check className="h-6 w-6" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t(UI.thanksTitle, lang)}</h1>
      <p className="text-lg text-body">{t(UI.thanksBody, lang)}</p>
    </section>
  );
}
