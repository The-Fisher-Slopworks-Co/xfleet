// src/db/servers.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

export type ServerRow = {
  id: number;
  name: string;
  inserted_at: Date;
  updated_at: Date;
};

type Db = SQL;

function shapeServer(r: any): ServerRow {
  return { ...r, id: toNum(r.id) };
}

export async function list(db: Db = sql()): Promise<ServerRow[]> {
  const rows = await db`SELECT * FROM servers ORDER BY name ASC`;
  return rows.map(shapeServer);
}
export async function get(id: number, db: Db = sql()): Promise<ServerRow | null> {
  const rows = await db`SELECT * FROM servers WHERE id = ${id}`;
  return rows[0] ? shapeServer(rows[0]) : null;
}
export async function create(attrs: { name: string }, db: Db = sql()): Promise<ServerRow> {
  const rows = await db`INSERT INTO servers (name) VALUES (${attrs.name}) RETURNING *`;
  return shapeServer(rows[0]!);
}
export async function update(id: number, attrs: { name?: string }, db: Db = sql()): Promise<ServerRow> {
  const rows = await db`
    UPDATE servers SET
      name = COALESCE(${attrs.name ?? null}, name),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return shapeServer(rows[0]!);
}
export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM servers WHERE id = ${id}`;
}
