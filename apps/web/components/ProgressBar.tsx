export function ProgressBar({
  value,
  label,
  className = '',
}: {
  /** 0 to 1. */
  value: number;
  label: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`pbar ${className}`}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
