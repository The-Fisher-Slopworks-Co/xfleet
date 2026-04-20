// src/server/routes/users.ts
import * as Users from "../../db/users";
import { userCreateSchema, userUpdateSchema } from "../../shared/schemas";
import { generateToken } from "../../domain/passwordGenerator";
import { requireAuth } from "../middleware";
import { badRequest, json, notFound, readJson, zodToErrors, noContent } from "../http";
import type { Env } from "../env";

export function usersRoutes(env: Env) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/users": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        return json(await Users.list());
      },
      async POST(req: Request) {
        const g = guard(req); if (g) return g;
        const parsed = userCreateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        try {
          const row = await Users.create(parsed.data);
          return json(row, { status: 201 });
        } catch (e: any) {
          return uniqueViolation(e);
        }
      },
    },
    "/api/admin/users/:id": {
      async GET(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const row = await Users.get(Number(req.params.id));
        return row ? json(row) : notFound();
      },
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = userUpdateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        try {
          return json(await Users.update(Number(req.params.id), parsed.data));
        } catch (e: any) {
          return uniqueViolation(e);
        }
      },
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        await Users.remove(Number(req.params.id));
        return noContent();
      },
    },
    "/api/admin/users/generate-token": {
      POST(req: Request) {
        const g = guard(req); if (g) return g;
        return json({ token: generateToken(32) });
      },
    },
  };
}

function uniqueViolation(e: any): Response {
  const msg = String(e?.message || e);
  if (/unique|duplicate/i.test(msg)) {
    if (/username/i.test(msg)) return badRequest({ username: ["has already been taken"] });
    if (/token/i.test(msg)) return badRequest({ token: ["has already been taken"] });
    return badRequest({ _: ["has already been taken"] });
  }
  throw e;
}
