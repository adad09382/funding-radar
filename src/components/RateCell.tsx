"use client";

interface RateCellProps {
  rate: number;
  showAnnualized?: boolean;
}

export function RateCell({ rate, showAnnualized }: RateCellProps) {
  const pct = (rate * 100).toFixed(4);
  const annualized = (rate * 3 * 365 * 100).toFixed(1);
  const color =
    rate > 0.0005
      ? "text-green-400"
      : rate < -0.0005
      ? "text-red-400"
      : "text-zinc-400";

  return (
    <span className={`font-mono tabular-nums ${color}`}>
      {rate >= 0 ? "+" : ""}
      {pct}%
      {showAnnualized && (
        <span className="ml-1 text-xs text-zinc-500">({annualized}%/年)</span>
      )}
    </span>
  );
}
