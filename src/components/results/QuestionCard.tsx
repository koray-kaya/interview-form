// One question on the results pages: its number in the margin, its text, and
// n at the top right; the chart or summary goes inside. Never split across
// printed pages.
export function QuestionCard({ number, text, n, note, children }: {
  number: number;
  text: string;
  n: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[1.75rem_1fr] gap-x-4 rounded-xl border border-border bg-white/70 p-5 break-inside-avoid sm:grid-cols-[2.5rem_1fr]">
      <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">{number}</span>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-medium text-foreground">{text}</h3>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">n = {n}</span>
        </div>
        {note && <p className="-mt-2 text-xs text-muted-foreground">{note}</p>}
        {children}
      </div>
    </section>
  );
}
