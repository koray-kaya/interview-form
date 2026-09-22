// The thin bar at the top of the page. Pure presentation.
type Props = { done: number; total: number };

export function ProgressBar({ done, total }: Props) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="fixed inset-x-0 top-0 z-10 h-1 bg-accent/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
    </div>
  );
}
