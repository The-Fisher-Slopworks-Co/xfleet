// src/server/routes/health.ts
import { json } from "../http";

export function healthRoutes() {
  return {
    "/api/health": {
      GET() {
        return json({ status: "ok" });
      },
    },
  };
}
