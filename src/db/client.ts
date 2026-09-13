// src/db/client.ts
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Named parameters for statements too wide to spell out their binding type. */
export type Bindings = Record<string, string | number | boolean | null>;

let dbInstance: Database | null = null;

export function db(): Database {
  if (!dbInstance) {
    const path = process.env.DATABASE_PATH;
    if (!path) throw new Error("DATABASE_PATH is not set");
    mkdirSync(dirname(path), { recursive: true });
    dbInstance = open(path);
  }
  return dbInstance;
}

function open(path: string): Database {
  // strict: named parameters bind without the `$` prefix and missing ones throw.
  const conn = new Database(path, { create: true, strict: true });
  conn.run("PRAGMA journal_mode = WAL");
  conn.run("PRAGMA synchronous = NORMAL");
  conn.run("PRAGMA foreign_keys = ON");
  conn.run("PRAGMA busy_timeout = 5000");
  return conn;
}

/** For tests only — point the singleton at a fresh in-memory database. */
export function __resetDbForTests(): void {
  dbInstance?.close();
  dbInstance = open(":memory:");
}

/** For tests only — delete every row and restart AUTOINCREMENT ids. */
export function __truncateForTests(): void {
  const conn = db();
  const tables = conn
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT IN ('schema_migrations', 'sqlite_sequence')",
    )
    .all();
  conn.run("PRAGMA foreign_keys = OFF");
  for (const { name } of tables) conn.run(`DELETE FROM "${name}"`);
  conn.run("DELETE FROM sqlite_sequence");
  conn.run("PRAGMA foreign_keys = ON");
}
