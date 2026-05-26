import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

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
  // getLatest() 使用 WHERE exchange = ? GROUP BY symbol，需要 exchange 在首欄
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_fr_exchange_sym_time
    ON funding_rates (exchange, symbol, funding_time DESC)
  `);
  console.log("index 建立完成: idx_fr_exchange_sym_time");

  // 確認現有 indexes
  const r = await db.execute(`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='funding_rates'`);
  for (const row of r.rows) {
    console.log(`  ${row.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
