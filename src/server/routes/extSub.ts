// src/server/routes/extSub.ts
import * as ExtSubSources from "../../db/extSubSources";
import * as ExtSubAssignments from "../../db/extSubAssignments";
import {
  extSubSourceCreateSchema,
  extSubSourceUpdateSchema,
  extSubAssignSchema,
} from "../../shared/schemas";
import { refreshSource } from "../../domain/extSubSync";
import type { Cipher } from "../../domain/crypto";
import type { SseHub } from "../sseHub";
import { requireAuth } from "../middleware";
import { badRequest, json, notFound, readJson, zodToErrors, noContent } from "../http";
import type { Env } from "../env";

export function extSubRoutes(env: Env, cipher: Cipher, hub: SseHub) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/ext-sub": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        const rows = await ExtSubSources.list();
        return json(rows.map(({ url: _u, ...rest }) => rest));
      },
      async POST(req: Request) {
        const g = guard(req); if (g) return g;
        const parsed = extSubSourceCreateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        try {
          const encrypted = await cipher.encrypt(parsed.data.url);
          const row = await ExtSubSources.create({
            name: parsed.data.name,
            url: encrypted,
            user_agent: parsed.data.user_agent,
            app_version: parsed.data.app_version,
            device_model: parsed.data.device_model,
            ver_os: parsed.data.ver_os,
            device_os: parsed.data.device_os,
            hwid: parsed.data.hwid,
          });
          const { url: _u, ...rest } = row;
          return json(rest, { status: 201 });
        } catch (e: any) {
          return uniqueViolation(e);
        }
      },
    },
    "/api/admin/ext-sub/:id": {
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = extSubSourceUpdateSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        const attrs: Partial<{
          name: string; url: string; user_agent: string;
          app_version: string; device_model: string; ver_os: string;
          device_os: string; hwid: string;
        }> = {};
        if (parsed.data.name !== undefined) attrs.name = parsed.data.name;
        if (parsed.data.user_agent !== undefined) attrs.user_agent = parsed.data.user_agent;
        if (parsed.data.app_version !== undefined) attrs.app_version = parsed.data.app_version;
        if (parsed.data.device_model !== undefined) attrs.device_model = parsed.data.device_model;
        if (parsed.data.ver_os !== undefined) attrs.ver_os = parsed.data.ver_os;
        if (parsed.data.device_os !== undefined) attrs.device_os = parsed.data.device_os;
        if (parsed.data.hwid !== undefined) attrs.hwid = parsed.data.hwid;
        if (parsed.data.url !== undefined) attrs.url = await cipher.encrypt(parsed.data.url);
        try {
          const row = await ExtSubSources.update(Number(req.params.id), attrs);
          const { url: _u, ...rest } = row;
          return json(rest);
        } catch (e: any) {
          return uniqueViolation(e);
        }
      },
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const existing = await ExtSubSources.get(Number(req.params.id));
        if (!existing) return notFound();
        await ExtSubSources.remove(Number(req.params.id));
        return noContent();
      },
    },
    "/api/admin/ext-sub/:id/refresh": {
      async POST(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const id = Number(req.params.id);
        const source = await ExtSubSources.get(id);
        if (!source) return notFound();
        void refreshSource({ sourceId: id, hub, cipher })
          .catch(err => console.error("[ext-sub]", err));
        return json({ accepted: true }, { status: 202 });
      },
    },
    "/api/admin/users/:id/ext-sub": {
      async GET(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const sourceIds = await ExtSubAssignments.listSourceIdsForUser(Number(req.params.id));
        return json({ source_ids: sourceIds });
      },
      async PUT(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const parsed = extSubAssignSchema.safeParse(await readJson(req));
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        await ExtSubAssignments.setForUser(Number(req.params.id), parsed.data.source_ids);
        return json({ source_ids: parsed.data.source_ids });
      },
    },
  };
}

function uniqueViolation(e: any): Response {
  const msg = String(e?.message || e);
  if (/unique|duplicate/i.test(msg)) {
    if (/name/i.test(msg)) return badRequest({ name: ["has already been taken"] });
    return badRequest({ _: ["has already been taken"] });
  }
  throw e;
}
