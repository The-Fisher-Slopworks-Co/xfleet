// src/db/users.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

export type UserRow = {
  id: number;
  username: string;
  token: string;
  inserted_at: Date;
  updated_at: Date;
};

type Db = SQL;

function shapeUser(r: any): UserRow {
  return { ...r, id: toNum(r.id) };
}

export async function list(db: Db = sql()): Promise<UserRow[]> {
  const rows = await db`SELECT * FROM users ORDER BY id ASC`;
  return rows.map(shapeUser);
}
export async function get(id: number, db: Db = sql()): Promise<UserRow | null> {
  const rows = await db`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? shapeUser(rows[0]) : null;
}
export async function getByToken(token: string, db: Db = sql()): Promise<UserRow | null> {
  const rows = await db`SELECT * FROM users WHERE token = ${token}`;
  return rows[0] ? shapeUser(rows[0]) : null;
}
export async function getByUsername(username: string, db: Db = sql()): Promise<UserRow | null> {
  const rows = await db`SELECT * FROM users WHERE username = ${username}`;
  return rows[0] ? shapeUser(rows[0]) : null;
}
export async function create(attrs: { username: string; token: string }, db: Db = sql()): Promise<UserRow> {
  const rows = await db`
    INSERT INTO users (username, token) VALUES (${attrs.username}, ${attrs.token})
    RETURNING *`;
  return shapeUser(rows[0]!);
}
export async function update(id: number, attrs: { username?: string; token?: string }, db: Db = sql()): Promise<UserRow> {
  const rows = await db`
    UPDATE users SET
      username = COALESCE(${attrs.username ?? null}, username),
      token    = COALESCE(${attrs.token ?? null}, token),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return shapeUser(rows[0]!);
}
export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM users WHERE id = ${id}`;
}
