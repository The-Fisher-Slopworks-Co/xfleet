// src/frontend/hooks/useSyncEvents.ts
import { useEffect, useRef, useState } from "react";

export type SubFetchEventRow = {
  id: number;
  user_id: number | null;
  attempted_token: string;
  ip: string | null;
  user_agent: string | null;
  headers: Record<string, string>;
  status_code: number;
  inserted_at: string;
  user: { id: number; username: string } | null;
};

export type SyncEvent =
  | { type: "sync_started"; serverId: number }
  | { type: "sync_complete"; serverId: number; result: Record<string, unknown> | { error: string } }
  | { type: "ext_sub_started"; sourceId: number }
  | { type: "ext_sub_complete"; sourceId: number; result: Record<string, unknown> | { error: string } }
  | { type: "sub_fetch"; row: SubFetchEventRow };

export function useSyncEvents(onEvent: (e: SyncEvent) => void): void {
  // Keep the callback in a ref so the EventSource is opened exactly once per mount.
  // A state update inside the callback would otherwise churn the effect and reconnect on every event.
  const cbRef = useRef(onEvent);
  useEffect(() => { cbRef.current = onEvent; });

  useEffect(() => {
    const es = new EventSource("/api/admin/events", { withCredentials: true });
    const handle = (e: MessageEvent) => {
      try { cbRef.current(JSON.parse(e.data)); } catch {}
    };
    es.addEventListener("sync_started", handle);
    es.addEventListener("sync_complete", handle);
    es.addEventListener("ext_sub_started", handle);
    es.addEventListener("ext_sub_complete", handle);
    es.addEventListener("sub_fetch", handle);
    return () => es.close();
  }, []);
}

export function useSubFetchEvents(onFetch: (row: SubFetchEventRow) => void): void {
  useSyncEvents(e => {
    if (e.type === "sub_fetch") onFetch(e.row);
  });
}

export function useLatestSyncState(): {
  syncingIds: Set<number>;
  lastEvent: SyncEvent | null;
} {
  const [syncingIds, setSyncing] = useState<Set<number>>(new Set());
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  useSyncEvents(e => {
    if (e.type !== "sync_started" && e.type !== "sync_complete") return;
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

export function useLatestExtSubState(): {
  refreshingIds: Set<number>;
  lastEvent: SyncEvent | null;
} {
  const [refreshingIds, setRefreshing] = useState<Set<number>>(new Set());
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  useSyncEvents(e => {
    if (e.type !== "ext_sub_started" && e.type !== "ext_sub_complete") return;
    setLastEvent(e);
    setRefreshing(prev => {
      const next = new Set(prev);
      if (e.type === "ext_sub_started") next.add(e.sourceId);
      else next.delete(e.sourceId);
      return next;
    });
  });
  return { refreshingIds, lastEvent };
}
