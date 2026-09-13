// src/db/servers.ts
import { db } from "./client";

export type ServerRow = {
  id: number;
  name: string;
  inserted_at: string;
  updated_at: string;
};

export function list(): ServerRow[] {
  return db().query<ServerRow, []>("SELECT * FROM servers ORDER BY name ASC").all();
}
export function get(id: number): ServerRow | null {
  return db().query<ServerRow, { id: number }>("SELECT * FROM servers WHERE id = $id").get({ id });
}
export function create(attrs: { name: string }): ServerRow {
  return db().query<ServerRow, { name: string }>("INSERT INTO servers (name) VALUES ($name) RETURNING *")
    .get({ name: attrs.name })!;
}
export function update(id: number, attrs: { name?: string }): ServerRow | null {
  return db().query<ServerRow, { id: number; name: string | null }>(`
    UPDATE servers SET
      name = COALESCE($name, name),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id
    RETURNING *`).get({ id, name: attrs.name ?? null });
}
export function remove(id: number): void {
  db().query<never, { id: number }>("DELETE FROM servers WHERE id = $id").run({ id });
}
