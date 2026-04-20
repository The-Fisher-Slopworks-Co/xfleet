// src/server/routes/auth.ts
import bcrypt from "bcryptjs";
import { loginSchema } from "../../shared/schemas";
import { issueSession, clearSessionCookie } from "../session";
import { requireAuth } from "../middleware";
import { badRequest, json, readJson, unauthorized, zodToErrors } from "../http";
import type { Env } from "../env";

export function authRoutes(env: Env) {
  return {
    "/api/auth/login": {
      async POST(req: Request) {
        const body = await readJson<unknown>(req);
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) return badRequest(zodToErrors(parsed.error.issues));
        const { username, password } = parsed.data;
        if (username !== env.adminUsername) return unauthorized();
        const ok = await bcrypt.compare(password, env.adminPasswordHash);
        if (!ok) return unauthorized();
        const { cookie } = issueSession(env.adminUsername, env.sessionSecret);
        return json({ ok: true }, { headers: { "set-cookie": cookie } });
      },
    },
    "/api/auth/logout": {
      POST() {
        return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
      },
    },
    "/api/auth/me": {
      GET(req: Request) {
        const auth = requireAuth(req, env);
        if (auth instanceof Response) return auth;
        return json({ username: auth.u });
      },
    },
  };
}
