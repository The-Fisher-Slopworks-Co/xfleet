// src/db/extSubAssignments.ts
import { sql, toNum } from "./client";
import type { SQL } from "bun";

type Db = SQL;

export async function listSourceIdsForUser(userId: number, db: Db = sql()): Promise<number[]> {
  const rows = await db`
    SELECT source_id FROM ext_sub_user_sources
    WHERE user_id = ${userId}
    ORDER BY source_id ASC`;
  return rows.map((r: any) => toNum(r.source_id));
}

export async function listUserIdsForSource(sourceId: number, db: Db = sql()): Promise<number[]> {
  const rows = await db`
    SELECT user_id FROM ext_sub_user_sources
    WHERE source_id = ${sourceId}
    ORDER BY user_id ASC`;
  return rows.map((r: any) => toNum(r.user_id));
}

export async function setForUser(userId: number, sourceIds: number[], db: Db = sql()): Promise<void> {
  await db.begin(async (tx: any) => {
    await tx`DELETE FROM ext_sub_user_sources WHERE user_id = ${userId}`;
    for (const sid of sourceIds) {
      await tx`
        INSERT INTO ext_sub_user_sources (source_id, user_id)
        VALUES (${sid}, ${userId})`;
    }
  });
}
