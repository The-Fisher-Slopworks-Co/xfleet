// src/domain/sync.ts
import { sql } from "../db/client";
import * as ThreeXUi from "../db/threeXUi";
import * as Users from "../db/users";
import * as Configs from "../db/configs";
import { buildVlessLink } from "./linkBuilder";
import type { LinkOverride } from "./linkBuilder";
import { generateToken } from "./passwordGenerator";
import type { Cipher } from "./crypto";
import type { ConfigTransform } from "../shared/schemas";
import type { SseHub } from "../server/sseHub";
import type { PanelServer, LoginResult, InboundsResult, ClientError } from "./threeXUiClient";

export type SyncStats = { created: number; updated: number; deleted: number; usersCreated: number };
export type SyncResult = { ok: true; stats: SyncStats } | { ok: false; error: string };

export type SyncClient = {
  login: (s: PanelServer) => Promise<LoginResult>;
  listInbounds: (s: PanelServer, cookie: string) => Promise<InboundsResult>;
};

const ADVISORY_LOCK_NAMESPACE = 1_337_001;

export async function syncServer(args: {
  panelId: number; client: SyncClient; hub: SseHub; cipher: Cipher;
}): Promise<SyncResult> {
  const { panelId, client, hub, cipher } = args;
  hub.broadcast({ type: "sync_started", serverId: panelId });

  let result: SyncResult;
  try {
    result = await doSync(panelId, client, cipher);
  } catch (e) {
    result = { ok: false, error: `unknown error: ${(e as Error).message}` };
  }

  const status = result.ok ? "ok" : `error: ${result.error}`;
  await ThreeXUi.updateSyncStatus(panelId, new Date(), status);

  hub.broadcast({
    type: "sync_complete",
    serverId: panelId,
    result: result.ok ? { ...result.stats } : { error: result.error },
  });
  return result;
}

async function doSync(panelId: number, client: SyncClient, cipher: Cipher): Promise<SyncResult> {
  const panel = await ThreeXUi.get(panelId);
  if (!panel) return { ok: false, error: "panel not found" };

  const plainPassword = await cipher.decrypt(panel.password);
  const panelServer: PanelServer = { ...panel, password: plainPassword };

  const login = await client.login(panelServer);
  if (!login.ok) return { ok: false, error: sanitize(login.error) };

  const inb = await client.listInbounds(panelServer, login.cookie);
  if (!inb.ok) return { ok: false, error: sanitize(inb.error) };

  const vless = inb.inbounds.filter(i => i.protocol === "vless");
  const entries = buildEntries(panel.host, vless, panel.config_transforms);

  const stats: SyncStats = await sql().begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_NAMESPACE}, ${panelId})`;
    let created = 0, updated = 0, usersCreated = 0;

    const existing = await tx`SELECT * FROM configs WHERE three_x_ui_server_id = ${panelId}`;
    const byEmail = new Map<string, any>(existing.map((c: any) => [c.external_email, c]));

    const syncedEmails: string[] = [];
    for (const entry of entries) {
      syncedEmails.push(entry.email);
      const { user, created: createdUser } = await findOrCreateUser(tx, entry.username);
      if (createdUser) usersCreated++;
      const prev = byEmail.get(entry.email);
      const attrs = {
        user_id: user.id, server_id: panel.server_id, config: entry.link,
        tag: entry.tag || null, three_x_ui_server_id: panelId, external_email: entry.email,
      };
      if (!prev) {
        await Configs.create(attrs, tx);
        created++;
      } else {
        await Configs.update(prev.id, attrs, tx);
        updated++;
      }
    }

    const deleted = await Configs.deleteMissingExternalEmails(panelId, syncedEmails, tx);
    return { created, updated, deleted, usersCreated };
  });

  return { ok: true, stats };
}

function buildEntries(
  host: string,
  inbounds: any[],
  transforms: ConfigTransform[] = [],
): Array<{ email: string; username: string; link: string; tag: string }> {
  const byTag = new Map(transforms.map(t => [t.tag, t]));
  const out: Array<{ email: string; username: string; link: string; tag: string }> = [];
  for (const inbound of inbounds) {
    let settings: any;
    try { settings = JSON.parse(inbound.settings || "{}"); } catch { continue; }
    const tag = inbound.remark || "";
    const rule = byTag.get(tag);
    const override: LinkOverride | undefined = rule ? { port: rule.port } : undefined;
    const clients = (settings.clients || []).filter((c: any) => c.enable);
    for (const c of clients) {
      const email = String(c.email ?? "");
      const username = parseUsername(email);
      if (!username) continue;
      const link = buildVlessLink(host, inbound, c, override);
      if (!link.ok) continue;
      out.push({ email, username, link: link.link, tag });
    }
  }
  return out;
}

function parseUsername(email: string): string | null {
  if (!email) return null;
  const dash = email.indexOf("-");
  const u = dash === -1 ? email : email.slice(0, dash);
  return u || null;
}

async function findOrCreateUser(tx: any, username: string): Promise<{ user: { id: number }; created: boolean }> {
  const existing = await Users.getByUsername(username, tx);
  if (existing) return { user: existing, created: false };
  try {
    const created = await Users.create({ username, token: generateToken(32) }, tx);
    return { user: created, created: true };
  } catch {
    const retry = await Users.getByUsername(username, tx);
    if (!retry) throw new Error(`findOrCreateUser failed for ${username}`);
    return { user: retry, created: false };
  }
}

function sanitize(e: ClientError): string {
  switch (e.kind) {
    case "auth_failed": return "authentication failed";
    case "no_cookie": return "no session cookie returned";
    case "unexpected_status": return `unexpected HTTP status ${e.status}`;
    case "connection_failed": return "connection failed";
    case "api_error": return `API error: ${e.msg.slice(0, 200)}`;
  }
}
