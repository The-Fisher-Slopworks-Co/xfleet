// src/server/routes/servers.ts
import * as Servers from "../../db/servers";
import { serverCreateSchema, serverUpdateSchema } from "../../shared/schemas";
import { requireAuth } from "../middleware";
import { badRequest, json, notFound, readJson, zodToErrors, noContent } from "../http";
import type { Env } from "../env";

export function serversRoutes(env: Env) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/servers": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        return json(await Servers.list());
      },
      async POST(req: Request) {
        const g = guard(req); if (g) return g;
        const parsed = serverCreateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        try {
          return json(await Servers.create(parsed.data), { status: 201 });
        } catch (e: any) {
          if (/unique|duplicate/i.test(String(e?.message))) return badRequest({ name: ["has already been taken"] });
          throw e;
        }
      },
    },
    "/api/admin/servers/:id": {
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = serverUpdateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        try {
          return json(await Servers.update(Number(req.params.id), parsed.data));
        } catch (e: any) {
          if (/unique|duplicate/i.test(String(e?.message))) return badRequest({ name: ["has already been taken"] });
          throw e;
        }
      },
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const existing = await Servers.get(Number(req.params.id));
        if (!existing) return notFound();
        await Servers.remove(Number(req.params.id));
        return noContent();
      },
    },
  };
}
