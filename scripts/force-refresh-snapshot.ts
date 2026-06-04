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

console.log("強制刷新所有 stable_snapshot windows（跳過 ① 新資料檢查）...");
refreshSnapshot(db)
  .then(() => {
    console.log("✓ 完成");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
