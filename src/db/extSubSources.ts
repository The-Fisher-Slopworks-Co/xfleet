// src/db/extSubSources.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

export type ExtSubSourceRow = {
  id: number;
  name: string;
  url: string;
  user_agent: string;
  app_version: string;
  device_model: string;
  ver_os: string;
  device_os: string;
  hwid: string;
  last_fetched_at: Date | null;
  last_fetch_status: string | null;
  inserted_at: Date;
  updated_at: Date;
};

export type ExtSubSourceAttrs = {
  name: string;
  url: string;
  user_agent: string;
  app_version: string;
  device_model: string;
  ver_os: string;
  device_os: string;
  hwid: string;
};

type Db = SQL;

function shape(r: any): ExtSubSourceRow {
  return { ...r, id: toNum(r.id) };
}

export async function list(db: Db = sql()): Promise<ExtSubSourceRow[]> {
  const rows = await db`SELECT * FROM ext_sub_sources ORDER BY name ASC`;
  return rows.map(shape);
}
export async function get(id: number, db: Db = sql()): Promise<ExtSubSourceRow | null> {
  const rows = await db`SELECT * FROM ext_sub_sources WHERE id = ${id}`;
  return rows[0] ? shape(rows[0]) : null;
}
export async function listByIds(ids: number[], db: Db = sql()): Promise<ExtSubSourceRow[]> {
  if (ids.length === 0) return [];
  const rows = await db`SELECT * FROM ext_sub_sources WHERE id IN ${db(ids)}`;
  return rows.map(shape);
}
export async function create(attrs: ExtSubSourceAttrs, db: Db = sql()): Promise<ExtSubSourceRow> {
  const rows = await db`
    INSERT INTO ext_sub_sources (
      name, url, user_agent, app_version, device_model, ver_os, device_os, hwid
    )
    VALUES (
      ${attrs.name}, ${attrs.url}, ${attrs.user_agent}, ${attrs.app_version},
      ${attrs.device_model}, ${attrs.ver_os}, ${attrs.device_os}, ${attrs.hwid}
    )
    RETURNING *`;
  return shape(rows[0]!);
}
export async function update(id: number, attrs: Partial<ExtSubSourceAttrs>, db: Db = sql()): Promise<ExtSubSourceRow> {
  const rows = await db`
    UPDATE ext_sub_sources SET
      name         = COALESCE(${attrs.name ?? null}, name),
      url          = COALESCE(${attrs.url ?? null}, url),
      user_agent   = COALESCE(${attrs.user_agent ?? null}, user_agent),
      app_version  = COALESCE(${attrs.app_version ?? null}, app_version),
      device_model = COALESCE(${attrs.device_model ?? null}, device_model),
      ver_os       = COALESCE(${attrs.ver_os ?? null}, ver_os),
      device_os    = COALESCE(${attrs.device_os ?? null}, device_os),
      hwid         = COALESCE(${attrs.hwid ?? null}, hwid),
      updated_at   = now()
    WHERE id = ${id}
    RETURNING *`;
  return shape(rows[0]!);
}
export async function remove(id: number, db: Db = sql()): Promise<void> {
  await db`DELETE FROM ext_sub_sources WHERE id = ${id}`;
}
export async function updateFetchStatus(id: number, at: Date, status: string, db: Db = sql()): Promise<void> {
  await db`
    UPDATE ext_sub_sources
    SET last_fetched_at = ${at}, last_fetch_status = ${status}, updated_at = now()
    WHERE id = ${id}`;
}
