import { Badge } from "@/components/ui/badge";
import { EXCHANGE_META } from "@/lib/types";
import type { Exchange } from "@/lib/types";

const CEX_COLORS: Record<string, string> = {
  binance:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  okx:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  bybit:    "bg-orange-500/15 text-orange-400 border-orange-500/30",
  bitget:   "bg-teal-500/15 text-teal-400 border-teal-500/30",
  mexc:     "bg-sky-500/15 text-sky-400 border-sky-500/30",
  gate:     "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  htx:      "bg-rose-500/15 text-rose-400 border-rose-500/30",
  kucoin:   "bg-green-500/15 text-green-400 border-green-500/30",
};

const DEX_COLORS: Record<string, string> = {
  hyperliquid: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  tradexyz:    "bg-amber-400/25 text-amber-300 border-amber-400/50",
  asterdex:    "bg-pink-500/15 text-pink-400 border-pink-500/30",
  lighter:     "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  edgex:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const ALL_COLORS = { ...CEX_COLORS, ...DEX_COLORS };

export function ExchangeBadge({ exchange, showType = false }: {
  exchange: Exchange;
  showType?: boolean;
}) {
  const meta = EXCHANGE_META[exchange];
  const color = ALL_COLORS[exchange] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="outline" className={`text-xs font-medium ${color}`}>
        {meta.label}
      </Badge>
      {showType && (
        <Badge
          variant="outline"
          className={
            meta.type === "dex"
              ? "text-xs bg-purple-500/10 text-purple-400 border-purple-500/20"
              : "text-xs bg-zinc-500/10 text-zinc-500 border-zinc-600/20"
          }
        >
          {meta.type.toUpperCase()}
        </Badge>
      )}
    </span>
  );
}
