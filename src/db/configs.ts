// src/db/configs.ts
import { sql, toNum, toNumOrNull } from "./client";
import type { SQL } from "bun";

export type ConfigRow = {
  id: number;
  user_id: number;
  server_id: number;
  config: string;
  tag: string | null;
  three_x_ui_server_id: number | null;
  external_email: string | null;
  inserted_at: Date;
  updated_at: Date;
};

export type ConfigWithServer = ConfigRow & { server: { id: number; name: string } };

type Db = SQL;

function stripServerName(s: string): string {
  const idx = s.indexOf("#");
  return idx === -1 ? s : s.slice(0, idx);
}

export async function listAll(db: Db = sql()): Promise<ConfigWithServer[]> {
  const rows = await db`
    SELECT c.*, s.name AS __server_name
    FROM configs c JOIN servers s ON s.id = c.server_id
    ORDER BY c.user_id ASC, c.server_id ASC`;
  return rows.map(shapeWithServer);
}
export async function listForUser(userId: number, db: Db = sql()): Promise<ConfigWithServer[]> {
  const rows = await db`
    SELECT c.*, s.name AS __server_name
    FROM configs c JOIN servers s ON s.id = c.server_id
    WHERE c.user_id = ${userId}
    ORDER BY c.id ASC`;
  return rows.map(shapeWithServer);
}
export async function get(id: number, db: Db = sql()): Promise<ConfigWithServer | null> {
  const rows = await db`
    SELECT c.*, s.name AS __server_name
    FROM configs c JOIN servers s ON s.id = c.server_id
    WHERE c.id = ${id}`;
  return rows[0] ? shapeWithServer(rows[0]) : null;
}
export async function create(attrs: {
  user_id: number; server_id: number; config: string; tag?: string | null;
  three_x_ui_server_id?: number | null; external_email?: string | null;
}, db: Db = sql()): Promise<ConfigRow> {
  const rows = await db`
    INSERT INTO configs (user_id, server_id, config, tag, three_x_ui_server_id, external_email)
    VALUES (${attrs.user_id}, ${attrs.server_id}, ${stripServerName(attrs.config)},
            ${attrs.tag ?? null}, ${attrs.three_x_ui_server_id ?? null}, ${attrs.external_email ?? null})
    RETURNING *`;
  return shapeConfigRow(rows[0]!);
}
export async function update(id: number, attrs: Partial<{
  user_id: number; server_id: number; config: string; tag: string | null;
  three_x_ui_server_id: number | null; external_email: string | null;
}>, db: Db = sql()): Promise<ConfigRow> {
  const cfg = attrs.config === undefined ? undefined : stripServerName(attrs.config);
  const rows = await db`
    UPDATE configs SET
      user_id = COALESCE(${attrs.user_id ?? null}, user_id),
      server_id = COALESCE(${attrs.server_id ?? null}, server_id),
      config = COALESCE(${cfg ?? null}, config),
      tag = CASE WHEN ${attrs.tag === undefined ? false : true}::boolean THEN ${attrs.tag ?? null} ELSE tag END,
      three_x_ui_server_id = CASE WHEN ${attrs.three_x_ui_server_id === undefined ? false : true}::boolean THEN ${attrs.three_x_ui_server_id ?? null} ELSE three_x_ui_server_id END,
      external_email = CASE WHEN ${attrs.external_email === undefined ? false : true}::boolean THEN ${attrs.external_email ?? null} ELSE external_email END,
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return shapeConfigRow(rows[0]!);
}
export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM configs WHERE id = ${id}`;
}
export async function listByPanelEmails(panelId: number, db: Db = sql()): Promise<ConfigRow[]> {
  const rows = await db`SELECT * FROM configs WHERE three_x_ui_server_id = ${panelId}`;
  return rows.map(shapeConfigRow);
}
export async function deleteMissingExternalEmails(panelId: number, keep: string[], db: Db = sql()): Promise<number> {
  if (keep.length === 0) {
    const result = await db`DELETE FROM configs WHERE three_x_ui_server_id = ${panelId}`;
    return toNum(result.count ?? 0);
  }
  const result = await db`
    DELETE FROM configs
    WHERE three_x_ui_server_id = ${panelId}
      AND external_email <> ALL(${keep})`;
  return toNum(result.count ?? 0);
}

function shapeConfigRow(r: any): ConfigRow {
  return {
    ...r,
    id: toNum(r.id),
    user_id: toNum(r.user_id),
    server_id: toNum(r.server_id),
    three_x_ui_server_id: toNumOrNull(r.three_x_ui_server_id),
  };
}

function shapeWithServer(row: any): ConfigWithServer {
  const { __server_name, ...rest } = row;
  const base = shapeConfigRow(rest);
  return { ...base, server: { id: toNum(row.server_id), name: __server_name } };
}
