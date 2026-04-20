// scripts/migrate-from-elixir.ts
import { SQL } from "bun";
import { plugCryptoDecrypt } from "./plugCrypto";
import { makeCipher } from "../src/domain/crypto";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

const OLD_URL = mustGetEnv("OLD_DATABASE_URL");
const NEW_URL = mustGetEnv("DATABASE_URL");
const OLD_SKB = mustGetEnv("OLD_SECRET_KEY_BASE");
const NEW_MASTER_KEY = mustGetEnv("MASTER_KEY");

const oldDb = new SQL(OLD_URL);
const newDb = new SQL(NEW_URL);
const cipher = await makeCipher(NEW_MASTER_KEY);

const users = await oldDb`SELECT id, username, token, inserted_at, updated_at FROM users ORDER BY id`;
const servers = await oldDb`SELECT id, name, inserted_at, updated_at FROM servers ORDER BY id`;
const panels = await oldDb`SELECT id, name, host, port, web_base_path, username, password, use_tls, server_id, last_synced_at, last_sync_status, inserted_at, updated_at FROM three_x_ui_servers ORDER BY id`;
const configs = await oldDb`SELECT id, user_id, server_id, config, tag, three_x_ui_server_id, external_email, inserted_at, updated_at FROM configs ORDER BY id`;

console.log(`[migrator] source rows: users=${users.length} servers=${servers.length} panels=${panels.length} configs=${configs.length}`);

// Spot-check decryption
if (panels.length > 0) {
  const sample = panels[0];
  const plain = await plugCryptoDecrypt(sample.password, OLD_SKB);
  console.log(`[migrator] spot-check: panel "${sample.name}" password decrypted (${plain.length} chars)`);
}

if (dryRun) {
  console.log("[migrator] --dry-run: not writing");
  process.exit(0);
}

if (!force) {
  console.error("[migrator] refusing to write without --force (would truncate destination tables)");
  process.exit(1);
}

// Safety check: destination must be empty
for (const table of ["users", "servers", "configs", "three_x_ui_servers"] as const) {
  const [{ count }] = await newDb`SELECT COUNT(*)::int AS count FROM ${newDb(table)}`;
  if (count > 0) {
    console.error(`[migrator] destination ${table} has ${count} rows; refusing to overwrite`);
    process.exit(1);
  }
}

await newDb.begin(async (tx: any) => {
  await tx`TRUNCATE users, servers, configs, three_x_ui_servers RESTART IDENTITY CASCADE`;

  for (const u of users) {
    await tx`INSERT INTO users (id, username, token, inserted_at, updated_at) VALUES (${u.id}, ${u.username}, ${u.token}, ${u.inserted_at}, ${u.updated_at})`;
  }
  for (const s of servers) {
    await tx`INSERT INTO servers (id, name, inserted_at, updated_at) VALUES (${s.id}, ${s.name}, ${s.inserted_at}, ${s.updated_at})`;
  }
  for (const p of panels) {
    const decrypted = await plugCryptoDecrypt(p.password, OLD_SKB);
    const reEncrypted = await cipher.encrypt(decrypted);
    await tx`
      INSERT INTO three_x_ui_servers (id, name, host, port, web_base_path, username, password, use_tls, server_id, last_synced_at, last_sync_status, inserted_at, updated_at)
      VALUES (${p.id}, ${p.name}, ${p.host}, ${p.port}, ${p.web_base_path}, ${p.username}, ${reEncrypted}, ${p.use_tls}, ${p.server_id}, ${p.last_synced_at}, ${p.last_sync_status}, ${p.inserted_at}, ${p.updated_at})`;
  }
  for (const c of configs) {
    await tx`
      INSERT INTO configs (id, user_id, server_id, config, tag, three_x_ui_server_id, external_email, inserted_at, updated_at)
      VALUES (${c.id}, ${c.user_id}, ${c.server_id}, ${c.config}, ${c.tag}, ${c.three_x_ui_server_id}, ${c.external_email}, ${c.inserted_at}, ${c.updated_at})`;
  }

  // Reset sequences so new inserts don't collide
  for (const seq of ["users_id_seq", "servers_id_seq", "configs_id_seq", "three_x_ui_servers_id_seq"]) {
    const table = seq.replace(/_id_seq$/, "");
    await tx.unsafe(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
  }
});

console.log("[migrator] done");
process.exit(0);

function mustGetEnv(k: string): string {
  const v = process.env[k];
  if (!v) { console.error(`[migrator] missing env: ${k}`); process.exit(1); }
  return v;
}
