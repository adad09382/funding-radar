import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { backfillLatestFundingTimes, ensureLatestFundingTimesTable } from "../src/lib/funding-db";

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
  await ensureLatestFundingTimesTable(db);
  const rowsAffected = await backfillLatestFundingTimes(db);
  console.log(`latest_funding_times backfill affected rows: ${rowsAffected}`);

  const counts = await db.execute(`
    SELECT
      source.exchange,
      source.symbols AS source_symbols,
      COALESCE(latest.symbols, 0) AS latest_symbols
    FROM (
      SELECT exchange, COUNT(DISTINCT symbol) AS symbols
      FROM funding_rates
      GROUP BY exchange
    ) source
    LEFT JOIN (
      SELECT exchange, COUNT(*) AS symbols
      FROM latest_funding_times
      GROUP BY exchange
    ) latest ON latest.exchange = source.exchange
    ORDER BY source.exchange
  `);

  console.log("\ncoverage by exchange:");
  for (const row of counts.rows) {
    console.log(`  ${row.exchange}: source=${row.source_symbols} latest=${row.latest_symbols}`);
  }

  const mismatches = await db.execute(`
    SELECT COUNT(*) AS mismatches
    FROM (
      SELECT exchange, symbol, MAX(funding_time) AS latest_funding_time
      FROM funding_rates
      GROUP BY exchange, symbol
    ) source
    JOIN latest_funding_times latest
      ON latest.exchange = source.exchange
     AND latest.symbol = source.symbol
    WHERE latest.latest_funding_time != source.latest_funding_time
  `);

  const mismatchCount = mismatches.rows[0].mismatches as number;
  console.log(`\ntimestamp mismatches: ${mismatchCount}`);
  if (mismatchCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.close());
