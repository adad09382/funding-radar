import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export async function initDB() {
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
}
