// src/db/extSubAssignments.ts
import { db } from "./client";

export function listSourceIdsForUser(userId: number): number[] {
  return db().query<{ source_id: number }, { userId: number }>(`
    SELECT source_id FROM ext_sub_user_sources
    WHERE user_id = $userId
    ORDER BY source_id ASC`).all({ userId }).map(r => r.source_id);
}

export function listUserIdsForSource(sourceId: number): number[] {
  return db().query<{ user_id: number }, { sourceId: number }>(`
    SELECT user_id FROM ext_sub_user_sources
    WHERE source_id = $sourceId
    ORDER BY user_id ASC`).all({ sourceId }).map(r => r.user_id);
}

export function setForUser(userId: number, sourceIds: number[]): void {
  const conn = db();
  conn.transaction(() => {
    conn.query<never, { userId: number }>("DELETE FROM ext_sub_user_sources WHERE user_id = $userId").run({ userId });
    const insert = conn.query<never, { sourceId: number; userId: number }>(`
      INSERT INTO ext_sub_user_sources (source_id, user_id)
      VALUES ($sourceId, $userId)`);
    for (const sourceId of sourceIds) insert.run({ sourceId, userId });
  })();
}
