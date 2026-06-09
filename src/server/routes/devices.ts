// src/server/routes/devices.ts
import * as Devices from "../../db/devices";
import { deviceBlockSchema, deviceLabelSchema } from "../../shared/schemas";
import { requireAuth } from "../middleware";
import { badRequest, json, noContent, notFound, parseId, parseLimit, readJson, zodToErrors } from "../http";
import type { Env } from "../env";

const DEFAULT_BLOCKED_LIMIT = 100;
const MAX_BLOCKED_LIMIT = 1000;

export function devicesRoutes(env: Env) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/users/:id/devices": {
      async GET(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const userId = Number(req.params.id);
        if (!Number.isFinite(userId) || userId <= 0) return json([]);
        return json(await Devices.listForUser(userId));
      },
    },
    "/api/admin/devices/blocked": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        const url = new URL(req.url);
        return json(await Devices.listBlocked({
          beforeId: parseId(url.searchParams.get("before_id")),
          limit: parseLimit(url.searchParams.get("limit"), DEFAULT_BLOCKED_LIMIT, MAX_BLOCKED_LIMIT),
        }));
      },
    },
    "/api/admin/devices/:id/block": {
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = deviceBlockSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        const row = await Devices.setBlocked(Number(req.params.id), parsed.data.blocked);
        return row ? json(row) : notFound();
      },
    },
    "/api/admin/devices/:id/label": {
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = deviceLabelSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        const row = await Devices.setLabel(Number(req.params.id), parsed.data.label || null);
        return row ? json(row) : notFound();
      },
    },
    "/api/admin/devices/:id": {
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        await Devices.remove(Number(req.params.id));
        return noContent();
      },
    },
  };
}
