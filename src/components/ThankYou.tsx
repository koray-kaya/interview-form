// The last screen: thanks, the reference code the participant can quote to
// have their answers removed, and — when they accepted a conversation — a
// line saying they will be contacted.
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";
import { Check } from "@/components/icons";

type Props = { lang: Lang; referenceCode?: string; inTouch?: boolean };

export function ThankYou({ lang, referenceCode, inTouch }: Props) {
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-2xl animate-enter-up flex-col justify-center gap-4 px-6 py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-md">
        <Check className="h-6 w-6" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t(UI.thanksTitle, lang)}</h1>
      <p className="text-lg text-body">
        {t(UI.thanksBody, lang)}
        {inTouch && <> {t(UI.inTouch, lang)}</>}
      </p>
      {referenceCode && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-white/70 p-5">
          <span className="text-sm text-muted-foreground">{t(UI.referenceCode, lang)}</span>
          <span className="font-mono text-2xl tracking-wider text-accent">{referenceCode}</span>
          <span className="text-sm leading-relaxed text-body">{t(UI.withdraw, lang)}</span>
        </div>
      )}
    </section>
  );
}
