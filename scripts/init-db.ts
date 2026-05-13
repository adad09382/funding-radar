import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS funding_rates (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol            TEXT    NOT NULL,
    exchange          TEXT    NOT NULL,
    rate              REAL    NOT NULL,
    next_funding_time INTEGER NOT NULL,
    recorded_at       INTEGER NOT NULL,
    UNIQUE (symbol, exchange, next_funding_time)
  )
`);

await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_funding_rates_recorded_at
  ON funding_rates (recorded_at DESC)
`);

console.log("DB 初始化完成");
