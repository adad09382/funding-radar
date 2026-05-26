"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { ExchangeBadge } from "@/components/ExchangeBadge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import type { StableAsset } from "@/lib/types";
import { RWA_ASSETS } from "@/lib/types";

const RWA_CATEGORY_LABEL: Record<string, { label: string; cls: string }> = {
  stock:     { label: "股票",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  etf:       { label: "ETF",    cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  commodity: { label: "大宗",   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  forex:     { label: "外匯",   cls: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
};

// symbol → category map，包含所有 symbolOverride（e.g. AAPLSTOCK → stock）
const RWA_MAP = new Map<string, string>();
for (const a of RWA_ASSETS) {
  RWA_MAP.set(a.symbol, a.category);
  if (a.symbolOverride) {
    for (const sym of Object.values(a.symbolOverride)) {
      RWA_MAP.set(sym, a.category);
    }
  }
}

function Hint({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <span
        className="ml-1 align-middle text-zinc-600 hover:text-zinc-400 cursor-help select-none inline-block"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ x: r.left, y: r.top });
        }}
        onMouseLeave={() => setPos(null)}
      >
        ⓘ
      </span>
      {pos && (
        <div
          className="fixed z-50 w-56 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-[11px] text-zinc-300 leading-relaxed shadow-xl pointer-events-none"
          style={{
            left: Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 240),
            top: pos.y - 8,
            transform: "translateY(-100%)",
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}

const WINDOWS = [1, 3, 5, 7, 14, 30] as const;
type WindowDay = (typeof WINDOWS)[number];

type SortMode = "yield" | "consistent" | "recent";
const SORT_LABELS: Record<SortMode, string> = {
  yield: "收益最高",
  consistent: "最穩定",
  recent: "當前最高",
};

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function heatColor(rate: number): string {
  if (rate > 0.0005) return "bg-emerald-400";
  if (rate > 0.0001) return "bg-emerald-600";
  if (rate > 0.000005) return "bg-emerald-900";
  if (rate >= -0.000005) return "bg-zinc-600";
  if (rate > -0.0001) return "bg-red-900";
  if (rate > -0.0005) return "bg-red-600";
  return "bg-red-400";
}

function Heatmap({ rates }: { rates: number[] }) {
  return (
    <div className="flex gap-px items-center">
      {rates.map((r, i) => (
        <div key={i} className={`w-1.5 h-3.5 rounded-[1px] ${heatColor(r)}`} title={pct(r)} />
      ))}
    </div>
  );
}

function dirColor(v: number) {
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}


interface Props {
  initialWindow: WindowDay;
}

export function StableClient({ initialWindow }: Props) {
  const [activeWindow, setActiveWindow] = useState<WindowDay>(initialWindow);
  const [sort, setSort] = useState<SortMode>("yield");
  const [rawAssets, setRawAssets] = useState<StableAsset[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await fetch(`/api/stable?window=${initialWindow}`);
      if (res.ok) {
        setRawAssets(await res.json());
        setError(false);
      } else {
        setError(true);
      }
      setInitialLoading(false);
    });
  }, []);

  // Sort is client-side — no API call needed
  const assets = useMemo(() => {
    const arr = [...rawAssets];
    if (sort === "yield")
      return arr.sort((a, b) => Math.abs(b.annMedian) - Math.abs(a.annMedian));
    if (sort === "consistent")
      return arr.sort(
        (a, b) => b.consistency - a.consistency || Math.abs(b.annMedian) - Math.abs(a.annMedian)
      );
    return arr.sort((a, b) => Math.abs(b.annCurrent) - Math.abs(a.annCurrent));
  }, [rawAssets, sort]);

  function onWindow(w: WindowDay) {
    setActiveWindow(w);
    startTransition(async () => {
      const res = await fetch(`/api/stable?window=${w}`);
      if (res.ok) {
        setRawAssets(await res.json());
        setError(false);
      } else {
        setError(true);
      }
    });
  }

  return (
    <>
    {(initialLoading || pending) && <LoadingOverlay />}
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">穩定費率</h1>
          <p className="text-xs text-zinc-500 mt-0.5">費率持續穩定的標的，適合長期期現套利。</p>
        </div>

        {/* 時間窗口 */}
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => onWindow(w)}
              disabled={pending}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeWindow === w
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {w}天
            </button>
          ))}
          {pending && <span className="text-xs text-zinc-500 self-center ml-1">載入中…</span>}
        </div>
      </div>

      {/* 排序切換 */}
      <div className="flex gap-1.5 items-center">
        <span className="text-xs text-zinc-500">排序：</span>
        {(["yield", "consistent", "recent"] as SortMode[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              sort === s
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {SORT_LABELS[s]}
          </button>
        ))}
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-zinc-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400">#</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400">幣種</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400">交易所</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                結算歷史
                <Hint text="每格代表一次結算期。綠色＝正費率（空方付多方），紅色＝負費率（多方付空方）。顏色越亮代表費率絕對值越大。" />
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                連續天數
                <Hint text="最近連續幾天的結算都與整體方向一致。例如 8.0天 代表最近 8 天每次結算都是正費率。數字越大代表趨勢越穩定。" />
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                一致率
                <Hint text="窗口內與主方向一致的結算佔比。100% 表示該期間每次都是正費率（或每次都是負費率），代表方向極為穩定。" />
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                中位數 年化
                <Hint text="用期間費率的中位數估算年化收益。比均值更穩健，不受少數極端高/低費率影響，是評估長期套利收益的主要參考指標。" />
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                均值 年化
                <Hint text="用期間費率的算術平均值估算年化收益。若有少數異常高費率拉高平均，此數字會高於中位數，需謹慎參考。" />
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                最差 年化
                <Hint text="用期間最不利的單次費率估算年化收益，代表最壞情況。正方向標的取最低那筆，負方向標的取最高那筆。是風險評估的下限參考。" />
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">
                當前 年化
                <Hint text="用最近一次結算費率估算年化收益，反映當下實際費率。若與中位數差距大，代表近期費率有明顯異動。" />
              </th>
            </tr>
          </thead>
          <tbody>
            {initialLoading && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-zinc-500 text-sm">
                  載入中…
                </td>
              </tr>
            )}
            {!initialLoading && error && (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-3xl">🛠</span>
                    <p className="text-zinc-300 font-medium">資料暫時無法取得</p>
                    <p className="text-zinc-500 text-xs max-w-xs">
                      歷史費率資料庫正在維護中，功能將在近期自動恢復。
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {!initialLoading && !error && assets.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-zinc-500 text-sm">
                  暫無資料
                </td>
              </tr>
            )}
            {!error && assets.map((a, i) => (
              <tr
                key={`${a.symbol}-${a.exchange}`}
                className="border-b border-zinc-800/60 hover:bg-zinc-900/50"
              >
                <td className="py-2 px-3 text-zinc-600 text-xs">{i + 1}</td>
                <td className="py-2 px-3">
                  <span className="font-mono font-bold text-white">{a.symbol}</span>
                  {RWA_MAP.has(a.symbol) && (() => {
                    const { label, cls } = RWA_CATEGORY_LABEL[RWA_MAP.get(a.symbol)!];
                    return (
                      <span className={`ml-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
                        {label}
                      </span>
                    );
                  })()}
                </td>
                <td className="py-2 px-3">
                  <ExchangeBadge exchange={a.exchange as never} />
                </td>
                <td className="py-2 px-3">
                  <Heatmap rates={a.heatmap} />
                </td>
                <td className={`py-2 px-3 text-right font-mono text-xs ${dirColor(a.annMedian)}`}>
                  {a.consecutiveDays}天
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs text-zinc-300">
                  {(a.consistency * 100).toFixed(0)}%
                </td>
                <td className={`py-2 px-3 text-right font-mono text-xs font-semibold ${dirColor(a.annMedian)}`}>
                  {pct(a.annMedian)}
                </td>
                <td className={`py-2 px-3 text-right font-mono text-xs ${dirColor(a.annMean)}`}>
                  {pct(a.annMean)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs text-zinc-500">
                  {pct(a.annWorst)}
                </td>
                <td className={`py-2 px-3 text-right font-mono text-xs ${dirColor(a.annCurrent)}`}>
                  {pct(a.annCurrent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!error && assets.length > 0 && (
        <p className="text-xs text-zinc-600">
          顯示前 {assets.length} 筆 · 年化 = 期間費率 × 年結算次數 · 最差為該期間單次最不利結算
        </p>
      )}
    </div>
    </>
  );
}
