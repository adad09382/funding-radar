import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "資金費率看板",
  description: "跨交易所加密貨幣資金費率監控與套利分析",
};

const NAV = [
  { href: "/arbitrage", label: "套利排行", enabled: true },
  { href: "/rwa", label: "RWA 專區", enabled: true },
  { href: "/stable", label: "穩定費率", enabled: false },
  { href: "/history", label: "歷史走勢", enabled: false },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-full flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-8 sticky top-0 bg-zinc-950/90 backdrop-blur z-50">
          <span className="font-bold text-white tracking-tight">⚡ 資金費率</span>
          <nav className="flex gap-1">
            {NAV.map((n) =>
              n.enabled ? (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 rounded text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  {n.label}
                </Link>
              ) : (
                <span
                  key={n.href}
                  className="px-3 py-1.5 rounded text-sm text-zinc-700 cursor-not-allowed"
                  title="即將開放"
                >
                  {n.label}
                </span>
              )
            )}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
