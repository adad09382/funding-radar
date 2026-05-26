import { NextRequest } from "next/server";
import { db } from "@/lib/turso";
import { computeStableAssets, SNAPSHOT_WINDOWS } from "@/lib/stable-snapshot";
import type { StableAsset } from "@/lib/types";

export const dynamic = "force-dynamic";

const SNAPSHOT_WINDOW_SET = new Set<number>(SNAPSHOT_WINDOWS);

export async function GET(req: NextRequest) {
  const windowDays = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get("window") ?? "7")));

  try {
    // 優先讀 snapshot（零成本）
    if (SNAPSHOT_WINDOW_SET.has(windowDays)) {
      const snap = await db.execute({
        sql: `SELECT data FROM stable_snapshot WHERE window_days = ?`,
        args: [windowDays],
      });
      if (snap.rows.length) {
        const assets = JSON.parse(snap.rows[0].data as string) as StableAsset[];
        return Response.json(assets, {
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
        });
      }
    }

    // Fallback：snapshot 尚未建立，或 window 不在預計算範圍內
    const assets = await computeStableAssets(db, windowDays);
    return Response.json(assets, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
