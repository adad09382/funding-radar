"use client";

import { useState, useTransition } from "react";
import { ExchangeBadge } from "@/components/ExchangeBadge";
import type { StableAsset } from "@/lib/types";

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
  initialAssets: StableAsset[];
  initialWindow: WindowDay;
}

export function StableClient({ initialAssets, initialWindow }: Props) {
  const [window, setWindow] = useState<WindowDay>(initialWindow);
  const [sort, setSort] = useState<SortMode>("yield");
  const [assets, setAssets] = useState<StableAsset[]>(initialAssets);
  const [pending, startTransition] = useTransition();

  async function load(w: WindowDay, s: SortMode) {
    const res = await fetch(`/api/stable?window=${w}&sort=${s}`);
    if (res.ok) setAssets(await res.json());
  }

  function onWindow(w: WindowDay) {
    setWindow(w);
    startTransition(() => { load(w, sort); });
  }

  function onSort(s: SortMode) {
    setSort(s);
    startTransition(() => { load(window, s); });
  }

  return (
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
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                window === w
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {w}天
            </button>
          ))}
        </div>
      </div>

      {/* 排序切換 */}
      <div className="flex gap-1.5 items-center">
        <span className="text-xs text-zinc-500">排序：</span>
        {(["yield", "consistent", "recent"] as SortMode[]).map((s) => (
          <button
            key={s}
            onClick={() => onSort(s)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              sort === s
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {SORT_LABELS[s]}
          </button>
        ))}
        {pending && <span className="text-xs text-zinc-500 ml-2">載入中…</span>}
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-zinc-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">#</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400">幣種</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400">交易所</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">結算歷史</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">連續天數</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">一致率</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">中位數 年化</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">均值 年化</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">最差 年化</th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-zinc-400 whitespace-nowrap">當前 年化</th>
            </tr>
          </thead>
          <tbody className={pending ? "opacity-50" : ""}>
            {assets.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-zinc-500 text-sm">
                  暫無資料
                </td>
              </tr>
            )}
            {assets.map((a, i) => (
              <tr key={`${a.symbol}-${a.exchange}`} className="border-b border-zinc-800/60 hover:bg-zinc-900/50">
                <td className="py-2 px-3 text-zinc-600 text-xs">{i + 1}</td>
                <td className="py-2 px-3 font-mono font-bold text-white">{a.symbol}</td>
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
                <td className={`py-2 px-3 text-right font-mono text-xs text-zinc-500`}>
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

      {assets.length > 0 && (
        <p className="text-xs text-zinc-600">
          顯示前 {assets.length} 筆 · 年化 = 期間費率 × 年結算次數 · 最差為該期間單次最不利結算
        </p>
      )}
    </div>
  );
}
