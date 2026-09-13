// src/db/extSubSources.ts
import { db, type Bindings } from "./client";

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
  last_fetched_at: string | null;
  last_fetch_status: string | null;
  inserted_at: string;
  updated_at: string;
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

export function list(): ExtSubSourceRow[] {
  return db().query<ExtSubSourceRow, []>("SELECT * FROM ext_sub_sources ORDER BY name ASC").all();
}
export function get(id: number): ExtSubSourceRow | null {
  return db().query<ExtSubSourceRow, { id: number }>("SELECT * FROM ext_sub_sources WHERE id = $id").get({ id });
}
export function listByIds(ids: number[]): ExtSubSourceRow[] {
  if (ids.length === 0) return [];
  return db().query<ExtSubSourceRow, { ids: string }>(`
    SELECT * FROM ext_sub_sources WHERE id IN (SELECT value FROM json_each($ids))`)
    .all({ ids: JSON.stringify(ids) });
}
export function create(attrs: ExtSubSourceAttrs): ExtSubSourceRow {
  return db().query<ExtSubSourceRow, Bindings>(`
    INSERT INTO ext_sub_sources (
      name, url, user_agent, app_version, device_model, ver_os, device_os, hwid
    )
    VALUES (
      $name, $url, $user_agent, $app_version,
      $device_model, $ver_os, $device_os, $hwid
    )
    RETURNING *`).get({
    name: attrs.name,
    url: attrs.url,
    user_agent: attrs.user_agent,
    app_version: attrs.app_version,
    device_model: attrs.device_model,
    ver_os: attrs.ver_os,
    device_os: attrs.device_os,
    hwid: attrs.hwid,
  })!;
}
export function update(id: number, attrs: Partial<ExtSubSourceAttrs>): ExtSubSourceRow | null {
  return db().query<ExtSubSourceRow, Bindings>(`
    UPDATE ext_sub_sources SET
      name         = COALESCE($name, name),
      url          = COALESCE($url, url),
      user_agent   = COALESCE($user_agent, user_agent),
      app_version  = COALESCE($app_version, app_version),
      device_model = COALESCE($device_model, device_model),
      ver_os       = COALESCE($ver_os, ver_os),
      device_os    = COALESCE($device_os, device_os),
      hwid         = COALESCE($hwid, hwid),
      updated_at   = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id
    RETURNING *`).get({
    id,
    name: attrs.name ?? null,
    url: attrs.url ?? null,
    user_agent: attrs.user_agent ?? null,
    app_version: attrs.app_version ?? null,
    device_model: attrs.device_model ?? null,
    ver_os: attrs.ver_os ?? null,
    device_os: attrs.device_os ?? null,
    hwid: attrs.hwid ?? null,
  });
}
export function remove(id: number): void {
  db().query<never, { id: number }>("DELETE FROM ext_sub_sources WHERE id = $id").run({ id });
}
export function updateFetchStatus(id: number, at: Date, status: string): void {
  db().query<never, { id: number; at: string; status: string }>(`
    UPDATE ext_sub_sources
    SET last_fetched_at = $at, last_fetch_status = $status, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id`).run({ id, at: at.toISOString(), status });
}
