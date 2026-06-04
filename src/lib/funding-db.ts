import type { Client } from "@libsql/client";

export type FundingRecord = {
  symbol: string;
  exchange: string;
  rate: number;
  fundingTime: number;
};

const latestTableEnsures = new WeakMap<Client, Promise<void>>();

export async function ensureLatestFundingTimesTable(db: Client): Promise<void> {
  const existing = latestTableEnsures.get(db);
  if (existing) return existing;

  const ensure = db.execute(`
      CREATE TABLE IF NOT EXISTS latest_funding_times (
        exchange            TEXT    NOT NULL,
        symbol              TEXT    NOT NULL,
        latest_funding_time INTEGER NOT NULL,
        PRIMARY KEY (exchange, symbol)
      )
    `)
    .then(() => undefined);

  latestTableEnsures.set(db, ensure);
  return ensure;
}

export async function backfillLatestFundingTimes(db: Client): Promise<number> {
  await ensureLatestFundingTimesTable(db);
  const result = await db.execute(`
    INSERT OR REPLACE INTO latest_funding_times (exchange, symbol, latest_funding_time)
    SELECT exchange, symbol, MAX(funding_time)
    FROM funding_rates
    GROUP BY exchange, symbol
  `);
  return result.rowsAffected;
}

async function getLatestFundingTimesFallback(
  db: Client,
  exchange: string
): Promise<Map<string, number>> {
  const fallback = await db.execute({
    sql: `
      SELECT symbol, MAX(funding_time) as t
      FROM funding_rates
      WHERE exchange = ?
      GROUP BY symbol
    `,
    args: [exchange],
  });
  return new Map(fallback.rows.map((row) => [row.symbol as string, row.t as number]));
}

export async function getLatestFundingTimes(
  db: Client,
  exchange: string,
  expectedSymbols?: string[]
): Promise<Map<string, number>> {
  await ensureLatestFundingTimesTable(db);

  const latest = await db.execute({
    sql: `
      SELECT symbol, latest_funding_time
      FROM latest_funding_times
      WHERE exchange = ?
    `,
    args: [exchange],
  });

  const latestMap = new Map(
    latest.rows.map((row) => [
      row.symbol as string,
      row.latest_funding_time as number,
    ])
  );

  const expected = expectedSymbols ? new Set(expectedSymbols) : null;
  if (expected) {
    for (const symbol of latestMap.keys()) {
      expected.delete(symbol);
    }
    if (expected.size > 0) {
      return getLatestFundingTimesFallback(db, exchange);
    }
  }

  return latestMap.size > 0 ? latestMap : getLatestFundingTimesFallback(db, exchange);
}

export async function syncLatestFundingTimes(
  db: Client,
  records: FundingRecord[]
): Promise<number> {
  if (!records.length) return 0;
  await ensureLatestFundingTimesTable(db);

  const latest = new Map<string, FundingRecord>();
  for (const record of records) {
    const key = `${record.exchange}\u0000${record.symbol}`;
    const existing = latest.get(key);
    if (!existing || record.fundingTime > existing.fundingTime) {
      latest.set(key, record);
    }
  }

  const rows = [...latest.values()];
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.batch(
      chunk.map((record) => ({
        sql: `
          INSERT INTO latest_funding_times (exchange, symbol, latest_funding_time)
          VALUES (?, ?, ?)
          ON CONFLICT(exchange, symbol) DO UPDATE SET
            latest_funding_time = MAX(
              latest_funding_times.latest_funding_time,
              excluded.latest_funding_time
            )
        `,
        args: [record.exchange, record.symbol, record.fundingTime],
      }))
    );
  }

  return rows.length;
}
