// src/db/threeXUi.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";
import type { ConfigTransform } from "../shared/schemas";

export type ThreeXUiRow = {
  id: number;
  name: string;
  host: string;
  port: number;
  web_base_path: string;
  username: string;
  password: string;
  use_tls: boolean;
  server_id: number;
  config_transforms: ConfigTransform[];
  last_synced_at: Date | null;
  last_sync_status: string | null;
  inserted_at: Date;
  updated_at: Date;
};
export type ThreeXUiWithVpnServer = ThreeXUiRow & { vpn_server: { id: number; name: string } };

type Db = SQL;

export async function list(db: Db = sql()): Promise<ThreeXUiWithVpnServer[]> {
  const rows = await db`
    SELECT t.*, s.name AS __server_name
    FROM three_x_ui_servers t JOIN servers s ON s.id = t.server_id
    ORDER BY t.name ASC`;
  return rows.map(shape);
}
export async function get(id: number, db: Db = sql()): Promise<ThreeXUiWithVpnServer | null> {
  const rows = await db`
    SELECT t.*, s.name AS __server_name
    FROM three_x_ui_servers t JOIN servers s ON s.id = t.server_id
    WHERE t.id = ${id}`;
  return rows[0] ? shape(rows[0]) : null;
}
export async function create(attrs: {
  name: string; host: string; port: number; web_base_path: string; username: string;
  password: string; use_tls: boolean; server_id: number; config_transforms?: ConfigTransform[];
}, db: Db = sql()): Promise<ThreeXUiRow> {
  const rows = await db`
    INSERT INTO three_x_ui_servers (name, host, port, web_base_path, username, password, use_tls, server_id, config_transforms)
    VALUES (${attrs.name}, ${attrs.host}, ${attrs.port}, ${attrs.web_base_path},
            ${attrs.username}, ${attrs.password}, ${attrs.use_tls}, ${attrs.server_id},
            ${JSON.stringify(attrs.config_transforms ?? [])}::jsonb)
    RETURNING *`;
  return shapeThreeXUi(rows[0]!);
}
export async function update(id: number, attrs: Partial<{
  name: string; host: string; port: number; web_base_path: string; username: string;
  password: string; use_tls: boolean; server_id: number; config_transforms: ConfigTransform[];
}>, db: Db = sql()): Promise<ThreeXUiRow> {
  const rows = await db`
    UPDATE three_x_ui_servers SET
      name = COALESCE(${attrs.name ?? null}, name),
      host = COALESCE(${attrs.host ?? null}, host),
      port = COALESCE(${attrs.port ?? null}, port),
      web_base_path = COALESCE(${attrs.web_base_path ?? null}, web_base_path),
      username = COALESCE(${attrs.username ?? null}, username),
      password = COALESCE(${attrs.password ?? null}, password),
      use_tls = COALESCE(${attrs.use_tls ?? null}, use_tls),
      server_id = COALESCE(${attrs.server_id ?? null}, server_id),
      config_transforms = CASE WHEN ${attrs.config_transforms === undefined ? false : true}::boolean
        THEN ${JSON.stringify(attrs.config_transforms ?? [])}::jsonb ELSE config_transforms END,
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return shapeThreeXUi(rows[0]!);
}
export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM three_x_ui_servers WHERE id = ${id}`;
}
export async function updateSyncStatus(id: number, at: Date, status: string, db: Db = sql()): Promise<void> {
  await db`UPDATE three_x_ui_servers SET last_synced_at = ${at}, last_sync_status = ${status}, updated_at = now() WHERE id = ${id}`;
}

// jsonb comes back as a parsed array (or a string in some envs); values written
// through Zod, so trust the shape — mirrors parseHeaders in subFetchJournal.ts.
function parseTransforms(v: unknown): ConfigTransform[] {
  if (Array.isArray(v)) return v as ConfigTransform[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as ConfigTransform[]) : [];
    } catch { return []; }
  }
  return [];
}

function shapeThreeXUi(r: any): ThreeXUiRow {
  return { ...r, id: toNum(r.id), server_id: toNum(r.server_id), config_transforms: parseTransforms(r.config_transforms) };
}

function shape(row: any): ThreeXUiWithVpnServer {
  const { __server_name, ...rest } = row;
  const base = shapeThreeXUi(rest);
  return { ...base, vpn_server: { id: toNum(row.server_id), name: __server_name } };
}
