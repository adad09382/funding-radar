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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS funding_rates (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol       TEXT    NOT NULL,
      exchange     TEXT    NOT NULL,
      rate         REAL    NOT NULL,
      funding_time INTEGER NOT NULL,
      UNIQUE (symbol, exchange, funding_time)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_funding_rates_funding_time
    ON funding_rates (funding_time DESC)
  `);

  console.log("DB 初始化完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
