// src/db/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { db } from "./client";

export async function runMigrations(migrationsDir = "migrations"): Promise<void> {
  const conn = db();
  const files = (await readdir(migrationsDir)).filter(f => f.endsWith(".sql")).sort();

  conn.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const appliedRows = conn.query<{ version: string }, []>("SELECT version FROM schema_migrations").all();
  const applied = new Set(appliedRows.map(r => r.version));

  for (const file of files) {
    const version = basename(file, ".sql");
    if (applied.has(version)) continue;
    const contents = await readFile(join(migrationsDir, file), "utf8");
    console.log(`[migrate] applying ${version}`);
    conn.transaction(() => {
      conn.run(contents);
      conn.query<never, { version: string }>("INSERT INTO schema_migrations (version) VALUES ($version)").run({ version });
    })();
  }
  console.log("[migrate] up to date");
}

if (import.meta.main) {
  await runMigrations();
  process.exit(0);
}
