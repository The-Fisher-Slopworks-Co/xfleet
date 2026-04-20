// src/db/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { sql } from "./client";

export async function runMigrations(migrationsDir = "migrations"): Promise<void> {
  const db = sql();
  const files = (await readdir(migrationsDir)).filter(f => f.endsWith(".sql")).sort();

  await db`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const appliedRows = await db`SELECT version FROM schema_migrations`;
  const applied = new Set(appliedRows.map((r: { version: string }) => r.version));

  for (const file of files) {
    const version = basename(file, ".sql");
    if (applied.has(version)) continue;
    const contents = await readFile(join(migrationsDir, file), "utf8");
    console.log(`[migrate] applying ${version}`);
    await db.begin(async (tx: typeof db) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO schema_migrations (version) VALUES (${version})`;
    });
  }
  console.log("[migrate] up to date");
}

if (import.meta.main) {
  await runMigrations();
  process.exit(0);
}
