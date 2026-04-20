// src/server/sseHub.test.ts
import { test, expect } from "bun:test";
import { makeSseHub } from "./sseHub";

test("subscribers receive broadcast events", async () => {
  const hub = makeSseHub();
  const { readable, close } = hub.subscribe();
  hub.broadcast({ type: "sync_started", serverId: 1 });
  hub.broadcast({ type: "sync_complete", serverId: 1, result: { created: 0 } });

  const reader = readable.getReader();
  const dec = new TextDecoder();
  let acc = "";
  for (let i = 0; i < 4; i++) {
    const { value } = await reader.read();
    if (!value) break;
    acc += dec.decode(value);
    if (acc.includes("sync_complete")) break;
  }
  expect(acc.includes("event: sync_started")).toBe(true);
  expect(acc.includes("event: sync_complete")).toBe(true);
  close();
});

test("close removes subscriber", () => {
  const hub = makeSseHub();
  const s = hub.subscribe();
  expect(hub.subscriberCount()).toBe(1);
  s.close();
  expect(hub.subscriberCount()).toBe(0);
});
