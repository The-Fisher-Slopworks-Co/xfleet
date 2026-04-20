// src/server/routes/events.ts
import { requireAuth } from "../middleware";
import type { Env } from "../env";
import type { SseHub } from "../sseHub";

export function eventsRoutes(env: Env, hub: SseHub) {
  return {
    "/api/admin/events": {
      GET(req: Request) {
        const auth = requireAuth(req, env);
        if (auth instanceof Response) return auth;
        const { readable } = hub.subscribe();
        return new Response(readable, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "x-accel-buffering": "no",
            connection: "keep-alive",
          },
        });
      },
    },
  };
}
