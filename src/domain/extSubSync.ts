// src/domain/extSubSync.ts
import { sql } from "../db/client";
import * as ExtSubSources from "../db/extSubSources";
import * as ExtSubLinks from "../db/extSubLinks";
import { fetchSubscription as defaultFetch } from "./extSubFetcher";
import { parseSubBody } from "./extSubParser";
import type { FetchResult, FetchError, FetchHeaders } from "./extSubFetcher";
import type { Cipher } from "./crypto";
import type { SseHub } from "../server/sseHub";

export type ExtSubSyncStats = { inserted: number; deleted: number };
export type ExtSubSyncResult =
  | { ok: true; stats: ExtSubSyncStats }
  | { ok: false; error: string };

export type Fetcher = (url: string, headers: FetchHeaders) => Promise<FetchResult>;

export const EXT_SUB_ADVISORY_LOCK_NAMESPACE = 1_337_002;

export async function refreshSource(args: {
  sourceId: number;
  hub: SseHub;
  cipher: Cipher;
  fetcher?: Fetcher;
}): Promise<ExtSubSyncResult> {
  const { sourceId, hub, cipher } = args;
  const fetcher = args.fetcher ?? defaultFetch;

  hub.broadcast({ type: "ext_sub_started", sourceId });

  let result: ExtSubSyncResult;
  try {
    result = await doRefresh(sourceId, cipher, fetcher);
  } catch (e) {
    result = { ok: false, error: `unknown error: ${(e as Error).message}` };
  }

  // Source may have been deleted mid-run (e.g. between scheduler list() and refresh).
  // Skip the status write and the complete event — the row no longer exists to report on.
  if (!result.ok && result.error === "source not found") return result;

  const status = result.ok ? "ok" : `error: ${result.error}`;
  await ExtSubSources.updateFetchStatus(sourceId, new Date(), status);

  hub.broadcast({
    type: "ext_sub_complete",
    sourceId,
    result: result.ok ? { ...result.stats } : { error: result.error },
  });
  return result;
}

async function doRefresh(sourceId: number, cipher: Cipher, fetcher: Fetcher): Promise<ExtSubSyncResult> {
  const source = await ExtSubSources.get(sourceId);
  if (!source) return { ok: false, error: "source not found" };

  const plainUrl = await cipher.decrypt(source.url);
  const fetched = await fetcher(plainUrl, {
    user_agent: source.user_agent,
    app_version: source.app_version,
    device_model: source.device_model,
    ver_os: source.ver_os,
    device_os: source.device_os,
    hwid: source.hwid,
  });
  if (!fetched.ok) return { ok: false, error: sanitize(fetched.error) };

  const links = parseSubBody(fetched.body);

  const stats: ExtSubSyncStats = await sql().begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(${EXT_SUB_ADVISORY_LOCK_NAMESPACE}, ${sourceId})`;
    return ExtSubLinks.replaceForSource(sourceId, links, tx);
  });

  return { ok: true, stats };
}

function sanitize(e: FetchError): string {
  switch (e.kind) {
    case "connection_failed": return "connection failed";
    case "unexpected_status": return `unexpected HTTP status ${e.status}`;
    case "empty_body": return "empty response body";
  }
}
