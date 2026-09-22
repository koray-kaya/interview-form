// The four small icons the form uses, drawn inline so nothing is fetched and
// no icon library is needed. Decorative: hidden from screen readers.
type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function ArrowRight({ className }: IconProps) {
  return <Svg className={className}><path d="M3 8h10M9 4l4 4-4 4" /></Svg>;
}

export function Check({ className }: IconProps) {
  return <Svg className={className}><path d="M3 8.5l3.2 3L13 4.5" /></Svg>;
}

export function ChevronUp({ className }: IconProps) {
  return <Svg className={className}><path d="M4 10l4-4 4 4" /></Svg>;
}

export function ChevronDown({ className }: IconProps) {
  return <Svg className={className}><path d="M4 6l4 4 4-4" /></Svg>;
}
