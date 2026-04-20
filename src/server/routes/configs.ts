// src/server/routes/configs.ts
import * as Configs from "../../db/configs";
import { configCreateSchema, configUpdateSchema } from "../../shared/schemas";
import { requireAuth } from "../middleware";
import { badRequest, json, notFound, readJson, zodToErrors, noContent } from "../http";
import type { Env } from "../env";

export function configsRoutes(env: Env) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/users/:id/configs": {
      async GET(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        return json(await Configs.listForUser(Number(req.params.id)));
      },
      async POST(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const body = await readJson<any>(req);
        const parsed = configCreateSchema.safeParse({ ...body, user_id: Number(req.params.id) });
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        return json(await Configs.create(parsed.data), { status: 201 });
      },
    },
    "/api/admin/configs/:id": {
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = configUpdateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        return json(await Configs.update(Number(req.params.id), parsed.data));
      },
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const existing = await Configs.get(Number(req.params.id));
        if (!existing) return notFound();
        await Configs.remove(Number(req.params.id));
        return noContent();
      },
    },
  };
}
