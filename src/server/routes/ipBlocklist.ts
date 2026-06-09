// src/server/routes/ipBlocklist.ts
import * as IpBlocklist from "../../db/ipBlocklist";
import { ipBlockCreateSchema } from "../../shared/schemas";
import { requireAuth } from "../middleware";
import { badRequest, json, noContent, readJson, zodToErrors } from "../http";
import type { Env } from "../env";

export function ipBlocklistRoutes(env: Env) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/ip-blocklist": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        return json(await IpBlocklist.list());
      },
      async POST(req: Request) {
        const g = guard(req); if (g) return g;
        const parsed = ipBlockCreateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        try {
          const row = await IpBlocklist.add({ cidr: parsed.data.cidr, note: parsed.data.note ?? null });
          return json(row, { status: 201 });
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (/invalid input syntax/i.test(msg)) return badRequest({ cidr: ["must be a valid IP or CIDR"] });
          if (/unique|duplicate/i.test(msg)) return badRequest({ cidr: ["is already blocked"] });
          throw e;
        }
      },
    },
    "/api/admin/ip-blocklist/:id": {
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        await IpBlocklist.remove(Number(req.params.id));
        return noContent();
      },
    },
  };
}
