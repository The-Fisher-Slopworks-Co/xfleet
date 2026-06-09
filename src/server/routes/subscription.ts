// src/server/routes/subscription.ts
import type { Server } from "bun";
import * as Users from "../../db/users";
import * as Configs from "../../db/configs";
import * as ExtSubLinks from "../../db/extSubLinks";
import * as SubFetchJournal from "../../db/subFetchJournal";
import type { DeviceRow } from "../../db/devices";
import { resolveDevice } from "../../domain/deviceResolver";
import { checkBlocked } from "../../domain/blockCheck";
import { json, text } from "../http";
import { clientIp, headersToRecord, truncate, MAX_TOKEN_LEN, MAX_USER_AGENT_LEN, MAX_HWID_LEN } from "../clientIp";
import type { Env } from "../env";
import type { SseHub } from "../sseHub";

function isBrowser(userAgent: string | null): boolean {
  return !!userAgent && userAgent.startsWith("Mozilla/");
}

export function subscriptionRoutes(env: Env, hub: SseHub | null = null) {
  return {
    "/sub/:token": {
      async GET(req: Request & { params: { token: string } }, server: Server<unknown> | null = null) {
        const token = req.params.token;
        const user = await Users.getByToken(token);
        const ip = clientIp(req, server, env);
        const headers = headersToRecord(req);
        const userAgent = truncate(req.headers.get("user-agent"), MAX_USER_AGENT_LEN);
        const hwid = truncate(req.headers.get("x-hwid"), MAX_HWID_LEN);
        const sudo = new URL(req.url).searchParams.get("sudo") === "1";

        let device: DeviceRow | null = null;
        let blockedBy: "device" | "ip" | null = null;

        const journal = async (status_code: number) => {
          try {
            const row = await SubFetchJournal.record({
              user_id: user?.id ?? null,
              attempted_token: truncate(token, MAX_TOKEN_LEN) ?? "",
              ip,
              user_agent: userAgent,
              headers,
              status_code,
              device_id: device?.id ?? null,
              blocked_by: blockedBy,
            });
            hub?.broadcast({
              type: "sub_fetch",
              row: {
                ...row,
                inserted_at: row.inserted_at.toISOString(),
                user: user ? { id: user.id, username: user.username } : null,
              },
            });
          } catch (e) {
            console.error("[sub-journal] write failed", e);
          }
        };

        if (!user) {
          await journal(404);
          return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
        }

        // Device tracking is best-effort: a failure must not break config delivery.
        try {
          device = await resolveDevice({ userId: user.id, hwid, userAgent, ip });
        } catch (e) {
          console.error("[devices] resolve failed", e);
        }

        const block = await checkBlocked({ device, ip });
        if (block.blocked) {
          blockedBy = block.by;
          await journal(404);
          // Stealth denial: indistinguishable from an unknown token.
          return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
        }

        if (isBrowser(userAgent) && !sudo) {
          await journal(302);
          return new Response(null, {
            status: 302,
            headers: { location: `/install/${token}` },
          });
        }
        const [configs, extLinks] = await Promise.all([
          Configs.listForUser(user.id),
          ExtSubLinks.listForUser(user.id),
        ]);
        const configLines = configs.map(c => {
          const base = `${c.config}#${c.server.name}`;
          return c.tag ? `${base}%20${encodeURIComponent(c.tag)}` : base;
        });
        const extLines = extLinks.map(l => {
          const fragment = l.label ? `${l.source_name} · ${l.label}` : l.source_name;
          return `${l.uri}#${encodeURIComponent(fragment)}`;
        });
        const body = [...configLines, ...extLines].join("\n");
        const title = `${env.profileTitle} - ${user.username}`;
        const resHeaders = { "profile-title": `base64:${Buffer.from(title).toString("base64")}` };
        await journal(200);
        return text(body, { headers: resHeaders });
      },
    },
    "/api/public/sub/:token": {
      async GET(req: Request & { params: { token: string } }) {
        const user = await Users.getByToken(req.params.token);
        if (!user) return json({ error: "not_found" }, { status: 404 });
        return json({
          username: user.username,
          subUrl: `${env.publicBaseUrl}/sub/${req.params.token}`,
        });
      },
    },
  };
}
