import { test, expect, beforeAll, beforeEach } from "bun:test";
import { __resetSqlForTests, sql } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as ExtSubSources from "../db/extSubSources";
import * as ExtSubLinks from "../db/extSubLinks";
import { makeSseHub } from "../server/sseHub";
import { makeCipher } from "./crypto";
import { refreshSource, type Fetcher } from "./extSubSync";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  test.skip("extSubSync integration tests skipped", () => {});
} else {
  const KEY = Buffer.alloc(32, 2).toString("base64");

  beforeAll(async () => {
    __resetSqlForTests(TEST_URL);
    await runMigrations();
  });
  beforeEach(async () => {
    const db = sql();
    await db`TRUNCATE ext_sub_sources, ext_sub_links RESTART IDENTITY CASCADE`;
  });

  const fakeFetch = (body: string): Fetcher =>
    async () => ({ ok: true as const, body });
  const failFetch: Fetcher = async () => ({ ok: false as const, error: { kind: "connection_failed" } });

  test("refreshSource stores parsed links and records ok status", async () => {
    const cipher = await makeCipher(KEY);
    const src = await ExtSubSources.create({
      name: "p1", url: await cipher.encrypt("https://prov/x"),
      user_agent: "ua", app_version: "", device_model: "", ver_os: "", device_os: "", hwid: "",
    });
    const hub = makeSseHub();
    const body = "vless://a#HK-01\nvmess://b";

    const res = await refreshSource({ sourceId: src.id, hub, cipher, fetcher: fakeFetch(body) });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.stats.inserted).toBe(2);
      expect(res.stats.deleted).toBe(0);
    }
    const links = await ExtSubLinks.listForSource(src.id);
    expect(links).toHaveLength(2);
    expect(links[0]!.uri).toBe("vless://a");
    expect(links[0]!.label).toBe("HK-01");
    expect(links[1]!.uri).toBe("vmess://b");
    expect(links[1]!.label).toBeNull();
    const after = await ExtSubSources.get(src.id);
    expect(after?.last_fetch_status).toBe("ok");
  });

  test("second refresh fully replaces the link set", async () => {
    const cipher = await makeCipher(KEY);
    const src = await ExtSubSources.create({
      name: "p1", url: await cipher.encrypt("https://prov/x"),
      user_agent: "ua", app_version: "", device_model: "", ver_os: "", device_os: "", hwid: "",
    });
    const hub = makeSseHub();

    await refreshSource({ sourceId: src.id, hub, cipher, fetcher: fakeFetch("vless://old1\nvless://old2") });
    const res = await refreshSource({ sourceId: src.id, hub, cipher, fetcher: fakeFetch("vless://new1") });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.stats.inserted).toBe(1);
      expect(res.stats.deleted).toBe(2);
    }
    const links = await ExtSubLinks.listForSource(src.id);
    expect(links.map(l => l.uri)).toEqual(["vless://new1"]);
  });

  test("records error status on fetch failure and keeps old links untouched", async () => {
    const cipher = await makeCipher(KEY);
    const src = await ExtSubSources.create({
      name: "p1", url: await cipher.encrypt("https://prov/x"),
      user_agent: "ua", app_version: "", device_model: "", ver_os: "", device_os: "", hwid: "",
    });
    const hub = makeSseHub();
    await refreshSource({ sourceId: src.id, hub, cipher, fetcher: fakeFetch("vless://keep") });

    const res = await refreshSource({ sourceId: src.id, hub, cipher, fetcher: failFetch });
    expect(res.ok).toBe(false);
    const after = await ExtSubSources.get(src.id);
    expect(after?.last_fetch_status).toBe("error: connection failed");
    const links = await ExtSubLinks.listForSource(src.id);
    expect(links.map(l => l.uri)).toEqual(["vless://keep"]);
  });

  test("returns error when source does not exist", async () => {
    const cipher = await makeCipher(KEY);
    const hub = makeSseHub();
    const res = await refreshSource({ sourceId: 999, hub, cipher, fetcher: fakeFetch("") });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("source not found");
  });

  test("broadcasts ext_sub_started then ext_sub_complete", async () => {
    const cipher = await makeCipher(KEY);
    const src = await ExtSubSources.create({
      name: "p1", url: await cipher.encrypt("https://prov/x"),
      user_agent: "ua", app_version: "", device_model: "", ver_os: "", device_os: "", hwid: "",
    });
    const hub = makeSseHub();
    const events: any[] = [];
    const sub = hub.subscribe();
    const reader = sub.readable.getReader();
    const dec = new TextDecoder();
    const collect = (async () => {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        const text = dec.decode(r.value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
        }
        if (events.length >= 2) break;
      }
    })();

    await refreshSource({ sourceId: src.id, hub, cipher, fetcher: fakeFetch("vless://a") });
    await collect;
    sub.close();

    expect(events[0]!.type).toBe("ext_sub_started");
    expect(events[0]!.sourceId).toBe(src.id);
    expect(events[1]!.type).toBe("ext_sub_complete");
    expect(events[1]!.sourceId).toBe(src.id);
  });
}
