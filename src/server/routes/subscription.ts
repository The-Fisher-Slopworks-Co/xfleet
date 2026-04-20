// src/server/routes/subscription.ts
import * as Users from "../../db/users";
import * as Configs from "../../db/configs";
import { text } from "../http";
import type { Env } from "../env";

export function subscriptionRoutes(env: Env) {
  return {
    "/sub/:token": {
      async GET(req: Request & { params: { token: string } }) {
        const user = await Users.getByToken(req.params.token);
        if (!user) return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
        const configs = await Configs.listForUser(user.id);
        const body = configs
          .map(c => {
            const base = `${c.config}#${c.server.name}`;
            return c.tag ? `${base}%20${encodeURIComponent(c.tag)}` : base;
          })
          .join("\n");
        const title = `${env.profileTitle} - ${user.username}`;
        const headers = { "profile-title": `base64:${Buffer.from(title).toString("base64")}` };
        return text(body, { headers });
      },
    },
  };
}
