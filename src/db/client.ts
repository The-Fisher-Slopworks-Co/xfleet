// src/db/client.ts
import { SQL } from "bun";

let sqlInstance: SQL | null = null;

export function sql(): SQL {
  if (!sqlInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sqlInstance = new SQL(url);
  }
  return sqlInstance;
}

/** For tests only — point the singleton at a different DB URL. */
export function __resetSqlForTests(url: string): void {
  sqlInstance = new SQL(url);
}

export function toNum(v: unknown): number {
  return typeof v === "string" ? Number(v) : (v as number);
}

export function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? Number(v) : (v as number);
}
