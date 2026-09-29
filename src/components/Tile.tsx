// One number on the admin and results pages, with its label and an optional hint.
export function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-white/70 p-4 break-inside-avoid">
      <span className="text-sm text-body">{label}</span>
      <span className="text-3xl font-semibold tabular-nums text-foreground">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
