"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Exchange } from "@/lib/types";

const EXCHANGES: Exchange[] = ["binance", "okx", "bybit", "bitget"];

interface HistoryPoint {
  rate: number;
  fundingTime: number;
}

export function HistoryClient() {
  const [symbol, setSymbol] = useState("BTC");
  const [exchange, setExchange] = useState<Exchange>("binance");
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchHistory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/history?symbol=${symbol.toUpperCase()}&exchange=${exchange}&limit=200`
      );
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(
        [...json].sort((a: HistoryPoint, b: HistoryPoint) => a.fundingTime - b.fundingTime)
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const chartData = data.map((d) => ({
    time: new Date(d.fundingTime).toLocaleDateString("zh-TW", { month: "short", day: "numeric" }),
    rate: parseFloat((d.rate * 100).toFixed(5)),
    rawTime: d.fundingTime,
  }));

  const avgRate = data.length > 0
    ? data.reduce((s, d) => s + d.rate, 0) / data.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">幣種</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTC"
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm w-28 font-mono uppercase focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">交易所</label>
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as Exchange)}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          >
            {EXCHANGES.map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-sm transition-colors"
        >
          {loading ? "載入中..." : "查詢"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {data.length > 0 && (
        <>
          <div className="flex gap-6 text-sm">
            <span className="text-zinc-500">
              共 <span className="text-white font-mono">{data.length}</span> 筆
            </span>
            <span className="text-zinc-500">
              平均費率：
              <span className={`font-mono ml-1 ${avgRate >= 0 ? "text-green-400" : "text-red-400"}`}>
                {avgRate >= 0 ? "+" : ""}
                {(avgRate * 100).toFixed(4)}%
              </span>
            </span>
            <span className="text-zinc-500">
              年化均值：
              <span className={`font-mono ml-1 ${avgRate >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(avgRate * 3 * 365 * 100).toFixed(1)}%
              </span>
            </span>
          </div>

          <div className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/30">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickFormatter={(v) => `${v.toFixed(3)}%`}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }}
                  labelStyle={{ color: "#a1a1aa" }}
                  formatter={(v) => [`${Number(v).toFixed(4)}%`, "資金費率"]}
                />
                <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 2" />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#a78bfa"
                  dot={false}
                  strokeWidth={1.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
