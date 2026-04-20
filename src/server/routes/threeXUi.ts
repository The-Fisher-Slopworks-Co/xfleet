// src/server/routes/threeXUi.ts
import * as ThreeXUi from "../../db/threeXUi";
import { threeXUiCreateSchema, threeXUiUpdateSchema, parseThreeXUiUrl } from "../../shared/schemas";
import { syncServer } from "../../domain/sync";
import { login as tLogin, listInbounds as tListInbounds } from "../../domain/threeXUiClient";
import type { Cipher } from "../../domain/crypto";
import type { SseHub } from "../sseHub";
import { requireAuth } from "../middleware";
import { badRequest, json, notFound, readJson, zodToErrors, noContent } from "../http";
import type { Env } from "../env";

export function threeXUiRoutes(env: Env, cipher: Cipher, hub: SseHub) {
  const guard = (req: Request) => {
    const a = requireAuth(req, env);
    return a instanceof Response ? a : null;
  };

  return {
    "/api/admin/three-x-ui": {
      async GET(req: Request) {
        const g = guard(req); if (g) return g;
        const rows = await ThreeXUi.list();
        // Never return password (even encrypted) over the wire
        return json(rows.map(({ password: _p, ...rest }) => rest));
      },
      async POST(req: Request) {
        const g = guard(req); if (g) return g;
        const body = await readJson<any>(req);
        const parsed = threeXUiCreateSchema.safeParse(body);
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        const parsedUrl = parseThreeXUiUrl(parsed.data.url);
        if ("error" in parsedUrl) return badRequest({ url: [parsedUrl.error] });
        const encrypted = await cipher.encrypt(parsed.data.password);
        const row = await ThreeXUi.create({
          name: parsed.data.name, host: parsedUrl.host, port: parsedUrl.port,
          web_base_path: parsedUrl.web_base_path, use_tls: parsedUrl.use_tls,
          username: parsed.data.username, password: encrypted, server_id: parsed.data.server_id,
        });
        const { password: _p, ...rest } = row;
        return json(rest, { status: 201 });
      },
    },
    "/api/admin/three-x-ui/:id": {
      async PATCH(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const body = await readJson<any>(req);
        const parsed = threeXUiUpdateSchema.safeParse(body);
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        const parsedUrl = parseThreeXUiUrl(parsed.data.url);
        if ("error" in parsedUrl) return badRequest({ url: [parsedUrl.error] });
        const attrs: Record<string, unknown> = {
          name: parsed.data.name, host: parsedUrl.host, port: parsedUrl.port,
          web_base_path: parsedUrl.web_base_path, use_tls: parsedUrl.use_tls,
          username: parsed.data.username, server_id: parsed.data.server_id,
        };
        if (parsed.data.password && parsed.data.password.trim() !== "") {
          attrs.password = await cipher.encrypt(parsed.data.password);
        }
        const row = await ThreeXUi.update(Number(req.params.id), attrs as any);
        const { password: _p, ...rest } = row;
        return json(rest);
      },
      async DELETE(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const existing = await ThreeXUi.get(Number(req.params.id));
        if (!existing) return notFound();
        await ThreeXUi.remove(Number(req.params.id));
        return noContent();
      },
    },
    "/api/admin/three-x-ui/:id/sync": {
      async POST(req: Request & { params: { id: string } }) {
        const g = guard(req); if (g) return g;
        const id = Number(req.params.id);
        const panel = await ThreeXUi.get(id);
        if (!panel) return notFound();
        // Fire and forget
        void syncServer({
          panelId: id,
          client: { login: tLogin, listInbounds: tListInbounds },
          hub, cipher,
        }).catch(err => console.error("[sync]", err));
        return json({ accepted: true }, { status: 202 });
      },
    },
  };
}
