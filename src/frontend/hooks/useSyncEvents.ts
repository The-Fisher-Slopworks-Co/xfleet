// src/frontend/hooks/useSyncEvents.ts
import { useEffect, useState } from "react";

export type SyncEvent =
  | { type: "sync_started"; serverId: number }
  | { type: "sync_complete"; serverId: number; result: Record<string, unknown> | { error: string } };

export function useSyncEvents(onEvent: (e: SyncEvent) => void): void {
  useEffect(() => {
    const es = new EventSource("/api/admin/events", { withCredentials: true });
    const handle = (e: MessageEvent) => {
      try { onEvent(JSON.parse(e.data)); } catch {}
    };
    es.addEventListener("sync_started", handle);
    es.addEventListener("sync_complete", handle);
    return () => es.close();
  }, [onEvent]);
}

export function useLatestSyncState(): {
  syncingIds: Set<number>;
  lastEvent: SyncEvent | null;
} {
  const [syncingIds, setSyncing] = useState<Set<number>>(new Set());
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  useSyncEvents(e => {
    setLastEvent(e);
    setSyncing(prev => {
      const next = new Set(prev);
      if (e.type === "sync_started") next.add(e.serverId);
      else next.delete(e.serverId);
      return next;
    });
  });
  return { syncingIds, lastEvent };
}
