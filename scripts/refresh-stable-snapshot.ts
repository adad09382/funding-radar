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
  console.log("刷新 stable_snapshot...");
  await refreshSnapshot(db);
  console.log("✓ 完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
