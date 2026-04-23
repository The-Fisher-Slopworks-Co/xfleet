// src/server/routes/subFetchJournal.ts
import * as SubFetchJournal from "../../db/subFetchJournal";
import { requireAuth } from "../middleware";
import { json } from "../http";
import type { Env } from "../env";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export function subFetchJournalRoutes(env: Env) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/sub-journal": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        const url = new URL(req.url);
        const rows = await SubFetchJournal.list({
          userId: parseId(url.searchParams.get("user_id")),
          beforeId: parseId(url.searchParams.get("before_id")),
          limit: parseLimit(url.searchParams.get("limit")),
        });
        return json(rows);
      },
    },
    "/api/admin/users/:id/sub-journal": {
      async GET(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const url = new URL(req.url);
        const userId = Number(req.params.id);
        if (!Number.isFinite(userId) || userId <= 0) return json([]);
        const rows = await SubFetchJournal.list({
          userId,
          beforeId: parseId(url.searchParams.get("before_id")),
          limit: parseLimit(url.searchParams.get("limit")),
        });
        return json(rows);
      },
    },
  };
}
