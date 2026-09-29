// One horizontal bar per option, in form order: a thin accent bar on a pale
// track that stands for n, then "count / n · share".
import { t, type Lang } from "@/i18n";
import { percent, shareLabel, type OptionCount } from "@/results";

export function OptionBars({ counts, n, lang }: { counts: OptionCount[]; n: number; lang: Lang }) {
  return (
    <ul className="flex flex-col gap-3">
      {counts.map(({ option, count }) => (
        <li key={option.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,15rem)_1fr_7rem]">
          <span className="text-body">{t(option.label, lang)}</span>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-border/70">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${percent(count, n)}%` }} />
          </span>
          <span className="tabular-nums text-foreground sm:text-right">{shareLabel(count, n)}</span>
        </li>
      ))}
    </ul>
  );
}
