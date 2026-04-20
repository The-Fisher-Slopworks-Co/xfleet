// src/domain/scheduler.ts
import * as ThreeXUi from "../db/threeXUi";
import { syncServer } from "./sync";
import { login, listInbounds } from "./threeXUiClient";
import type { Cipher } from "./crypto";
import type { SseHub } from "../server/sseHub";

const INTERVAL_MS = 5 * 60_000;

export function startScheduler(args: { hub: SseHub; cipher: Cipher }): () => void {
  if (process.env.NODE_ENV === "test") return () => {};

  const inFlight = new Map<number, Promise<unknown>>();

  async function tick() {
    const panels = await ThreeXUi.list();
    for (const p of panels) {
      if (inFlight.has(p.id)) continue;
      const task = syncServer({
        panelId: p.id,
        client: { login, listInbounds },
        hub: args.hub,
        cipher: args.cipher,
      })
        .then(r => {
          if (r.ok) {
            console.log(`[sync] ${p.name}: +${r.stats.created} ~${r.stats.updated} -${r.stats.deleted} users+${r.stats.usersCreated}`);
          } else {
            console.error(`[sync] ${p.name}: ${r.error}`);
          }
        })
        .catch(err => console.error(`[sync] ${p.name}:`, err))
        .finally(() => inFlight.delete(p.id));
      inFlight.set(p.id, task);
    }
  }

  // Run once on startup then on interval
  void tick();
  const handle = setInterval(() => { void tick(); }, INTERVAL_MS);
  return () => clearInterval(handle);
}
