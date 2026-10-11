// src/db/users.ts
import { db } from "./client";

export type UserRow = {
  id: number;
  username: string;
  token: string;
  inserted_at: string;
  updated_at: string;
};

export function list(): UserRow[] {
  return db().query<UserRow, []>("SELECT * FROM users ORDER BY id ASC").all();
}
export function get(id: number): UserRow | null {
  return db()
    .query<UserRow, { id: number }>("SELECT * FROM users WHERE id = $id")
    .get({ id });
}
export function getByToken(token: string): UserRow | null {
  return db()
    .query<UserRow, { token: string }>(
      "SELECT * FROM users WHERE token = $token",
    )
    .get({ token });
}
export function getByUsername(username: string): UserRow | null {
  return db()
    .query<UserRow, { username: string }>(
      "SELECT * FROM users WHERE username = $username",
    )
    .get({ username });
}
export function create(attrs: { username: string; token: string }): UserRow {
  return db()
    .query<UserRow, { username: string; token: string }>(
      `
    INSERT INTO users (username, token) VALUES ($username, $token)
    RETURNING *`,
    )
    .get({ username: attrs.username, token: attrs.token })!;
}
export function update(
  id: number,
  attrs: { username?: string; token?: string },
): UserRow | null {
  return db()
    .query<
      UserRow,
      { id: number; username: string | null; token: string | null }
    >(
      `
    UPDATE users SET
      username   = COALESCE($username, username),
      token      = COALESCE($token, token),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = $id
    RETURNING *`,
    )
    .get({ id, username: attrs.username ?? null, token: attrs.token ?? null });
}
export function remove(id: number): void {
  db()
    .query<never, { id: number }>("DELETE FROM users WHERE id = $id")
    .run({ id });
}
