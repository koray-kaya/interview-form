// The last screen. M2 adds the reference code and the contact line.
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

export function ThankYou({ lang }: { lang: Lang }) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-normal">{t(UI.thanksTitle, lang)}</h1>
      <p className="text-lg">{t(UI.thanksBody, lang)}</p>
    </section>
  );
}
