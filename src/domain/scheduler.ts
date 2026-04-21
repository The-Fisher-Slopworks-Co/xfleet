// src/domain/scheduler.ts
import * as ThreeXUi from "../db/threeXUi";
import * as ExtSubSources from "../db/extSubSources";
import { syncServer } from "./sync";
import { refreshSource } from "./extSubSync";
import { login, listInbounds } from "./threeXUiClient";
import type { Cipher } from "./crypto";
import type { SseHub } from "../server/sseHub";

const INTERVAL_MS = 5 * 60_000;

export function startScheduler(args: { hub: SseHub; cipher: Cipher }): () => void {
  if (process.env.NODE_ENV === "test") return () => {};

  const panelInFlight = new Map<number, Promise<unknown>>();
  const extSubInFlight = new Map<number, Promise<unknown>>();

  async function tickPanels() {
    const panels = await ThreeXUi.list();
    for (const p of panels) {
      if (panelInFlight.has(p.id)) continue;
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
        .finally(() => panelInFlight.delete(p.id));
      panelInFlight.set(p.id, task);
    }
  }

  async function tickExtSub() {
    const sources = await ExtSubSources.list();
    for (const s of sources) {
      if (extSubInFlight.has(s.id)) continue;
      const task = refreshSource({ sourceId: s.id, hub: args.hub, cipher: args.cipher })
        .then(r => {
          if (r.ok) {
            console.log(`[ext-sub] ${s.name}: +${r.stats.inserted} -${r.stats.deleted}`);
          } else {
            console.error(`[ext-sub] ${s.name}: ${r.error}`);
          }
        })
        .catch(err => console.error(`[ext-sub] ${s.name}:`, err))
        .finally(() => extSubInFlight.delete(s.id));
      extSubInFlight.set(s.id, task);
    }
  }

  function tick() {
    void tickPanels();
    void tickExtSub();
  }

  tick();
  const handle = setInterval(tick, INTERVAL_MS);
  return () => clearInterval(handle);
}
