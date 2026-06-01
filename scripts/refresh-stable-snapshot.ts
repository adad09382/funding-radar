import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { refreshSnapshot } from "../src/lib/stable-snapshot";

try {
  const text = readFileSync(".env.local", "utf-8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  // 如果 funding_rates 沒有比上次 snapshot 更新的資料，跳過
  const [latestRow, snapRow] = await Promise.all([
    db.execute("SELECT MAX(funding_time) as t FROM funding_rates"),
    db.execute({ sql: "SELECT updated_at FROM stable_snapshot WHERE window_days = 7", args: [] }),
  ]);
  const maxFundingTime = latestRow.rows[0].t as number | null;
  const lastUpdatedAt = snapRow.rows.length ? (snapRow.rows[0].updated_at as number) : 0;

  if (maxFundingTime !== null && maxFundingTime <= lastUpdatedAt) {
    console.log("無新資料（MAX funding_time 未超過上次 snapshot），跳過 refresh。");
    return;
  }

  console.log("刷新 stable_snapshot...");
  await refreshSnapshot(db);
  console.log("✓ 完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
