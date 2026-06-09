// src/server/sseHub.ts
export type SubFetchEventRow = {
  id: number;
  user_id: number | null;
  attempted_token: string;
  ip: string | null;
  user_agent: string | null;
  headers: Record<string, string>;
  status_code: number;
  device_id: number | null;
  blocked_by: "device" | "ip" | null;
  inserted_at: string;
  user: { id: number; username: string } | null;
};

export type SyncEvent =
  | { type: "sync_started"; serverId: number }
  | { type: "sync_complete"; serverId: number; result: Record<string, unknown> | { error: string } }
  | { type: "ext_sub_started"; sourceId: number }
  | { type: "ext_sub_complete"; sourceId: number; result: Record<string, unknown> | { error: string } }
  | { type: "sub_fetch"; row: SubFetchEventRow };

export type SseHub = {
  broadcast: (event: SyncEvent) => void;
  subscribe: () => { readable: ReadableStream<Uint8Array>; close: () => void };
  subscriberCount: () => number;
};

export function makeSseHub(): SseHub {
  const subscribers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const enc = new TextEncoder();

  function format(event: SyncEvent): Uint8Array {
    return enc.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  function broadcast(event: SyncEvent): void {
    const chunk = format(event);
    for (const c of subscribers) {
      try { c.enqueue(chunk); } catch { subscribers.delete(c); }
    }
  }

  function subscribe() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const keepaliveInterval = setInterval(() => {
      try { controller.enqueue(enc.encode(": keepalive\n\n")); } catch {}
    }, 15_000);

    const readable = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        subscribers.add(c);
      },
      cancel() {
        subscribers.delete(controller);
        clearInterval(keepaliveInterval);
      },
    });

    return {
      readable,
      close() {
        clearInterval(keepaliveInterval);
        subscribers.delete(controller);
        try { controller.close(); } catch {}
      },
    };
  }

  return { broadcast, subscribe, subscriberCount: () => subscribers.size };
}
