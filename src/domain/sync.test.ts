// src/domain/sync.test.ts
import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as Servers from "../db/servers";
import * as ThreeXUi from "../db/threeXUi";
import * as Configs from "../db/configs";
import * as Users from "../db/users";
import { makeSseHub } from "../server/sseHub";
import { makeCipher } from "./crypto";
import { syncServer } from "./sync";
import type { PanelServer, LoginResult, InboundsResult } from "./threeXUiClient";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("sync integration tests skipped", () => {});
} else {
  const KEY = Buffer.alloc(32, 1).toString("base64");

  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    const db = sql();
    await db`TRUNCATE users, servers, configs, three_x_ui_servers RESTART IDENTITY CASCADE`;
  });

  function fakeClient(responses: { login: LoginResult; inbounds: InboundsResult }) {
    return {
      login: async (_: PanelServer) => responses.login,
      listInbounds: async (_: PanelServer, __: string) => responses.inbounds,
    };
  }

  test("sync creates users and configs on first run", async () => {
    const cipher = await makeCipher(KEY);
    const s = await Servers.create({ name: "eu" });
    const t = await ThreeXUi.create({
      name: "p", host: "h", port: 2053, web_base_path: "/", username: "u",
      password: await cipher.encrypt("pw"), use_tls: true, server_id: s.id,
    });
    const hub = makeSseHub();
    const client = fakeClient({
      login: { ok: true, cookie: "sid=1" },
      inbounds: {
        ok: true,
        inbounds: [{
          protocol: "vless",
          port: 443,
          listen: "",
          remark: "tag-a",
          settings: JSON.stringify({ clients: [{ id: "uuid-1", email: "alice-dev", enable: true }] }),
          streamSettings: JSON.stringify({ network: "tcp", security: "none", tcpSettings: {} }),
        }],
      },
    });

    const res = await syncServer({ panelId: t.id, client, hub, cipher });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.stats.created).toBe(1);
      expect(res.stats.usersCreated).toBe(1);
    }
    expect((await Users.list()).map(u => u.username)).toEqual(["alice"]);
    const configs = await Configs.listAll();
    expect(configs).toHaveLength(1);
    expect(configs[0]!.external_email).toBe("alice-dev");
  });

  test("config_transforms rewrites the port for the matching tag only", async () => {
    const cipher = await makeCipher(KEY);
    const s = await Servers.create({ name: "eu" });
    const t = await ThreeXUi.create({
      name: "p", host: "h", port: 2053, web_base_path: "/", username: "u",
      password: await cipher.encrypt("pw"), use_tls: true, server_id: s.id,
      config_transforms: [{ tag: "Port443 XHTTP", port: 443 }],
    });
    const hub = makeSseHub();
    const client = fakeClient({
      login: { ok: true, cookie: "sid=1" },
      inbounds: {
        ok: true,
        inbounds: [
          {
            protocol: "vless", port: 8445, listen: "", remark: "Port443 XHTTP",
            settings: JSON.stringify({ clients: [{ id: "uuid-1", email: "alice-x", enable: true }] }),
            streamSettings: JSON.stringify({ network: "xhttp", security: "none", xhttpSettings: {} }),
          },
          {
            protocol: "vless", port: 8446, listen: "", remark: "plain",
            settings: JSON.stringify({ clients: [{ id: "uuid-2", email: "bob-y", enable: true }] }),
            streamSettings: JSON.stringify({ network: "tcp", security: "none", tcpSettings: {} }),
          },
        ],
      },
    });

    const res = await syncServer({ panelId: t.id, client, hub, cipher });
    expect(res.ok).toBe(true);
    const byEmail = new Map((await Configs.listAll()).map(c => [c.external_email, c.config]));
    expect(byEmail.get("alice-x")).toContain("@h:443"); // overridden 8445 -> 443
    expect(byEmail.get("bob-y")).toContain("@h:8446"); // non-matching tag untouched
  });

  test("sync deletes configs whose emails disappeared", async () => {
    const cipher = await makeCipher(KEY);
    const s = await Servers.create({ name: "eu" });
    const t = await ThreeXUi.create({
      name: "p", host: "h", port: 2053, web_base_path: "/", username: "u",
      password: await cipher.encrypt("pw"), use_tls: true, server_id: s.id,
    });
    const u = await Users.create({ username: "alice", token: "tok" });
    await Configs.create({
      user_id: u.id, server_id: s.id, config: "vless://old", tag: null,
      three_x_ui_server_id: t.id, external_email: "alice-old",
    });

    const hub = makeSseHub();
    const client = fakeClient({
      login: { ok: true, cookie: "sid=1" },
      inbounds: { ok: true, inbounds: [] },
    });

    const res = await syncServer({ panelId: t.id, client, hub, cipher });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.stats.deleted).toBe(1);
    expect(await Configs.listAll()).toHaveLength(0);
  });

  test("sync records error status on login failure", async () => {
    const cipher = await makeCipher(KEY);
    const s = await Servers.create({ name: "eu" });
    const t = await ThreeXUi.create({
      name: "p", host: "h", port: 2053, web_base_path: "/", username: "u",
      password: await cipher.encrypt("pw"), use_tls: true, server_id: s.id,
    });
    const hub = makeSseHub();
    const client = fakeClient({
      login: { ok: false, error: { kind: "auth_failed" } },
      inbounds: { ok: true, inbounds: [] },
    });
    const res = await syncServer({ panelId: t.id, client, hub, cipher });
    expect(res.ok).toBe(false);
    const after = await ThreeXUi.get(t.id);
    expect(after?.last_sync_status).toBe("error: authentication failed");
  });
}
