// src/server/routes/subscription.ts
import * as Users from "../../db/users";
import * as Configs from "../../db/configs";
import * as ExtSubLinks from "../../db/extSubLinks";
import { text } from "../http";
import type { Env } from "../env";

export function subscriptionRoutes(env: Env) {
  return {
    "/sub/:token": {
      async GET(req: Request & { params: { token: string } }) {
        const user = await Users.getByToken(req.params.token);
        if (!user) return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
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
        const headers = { "profile-title": `base64:${Buffer.from(title).toString("base64")}` };
        return text(body, { headers });
      },
    },
  };
}
