// src/server/env.ts
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().min(1),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  SESSION_SECRET: z.string().min(32),
  MASTER_KEY: z.string().refine(v => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "MASTER_KEY must be base64 of 32 bytes"),
  PROFILE_TITLE: z.string().default("VPN"),
  PUBLIC_BASE_URL: z.string().url(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  SUB_JOURNAL_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
});

export type Env = {
  port: number;
  databaseUrl: string;
  adminUsername: string;
  adminPasswordHash: string;
  sessionSecret: string;
  masterKey: string;
  profileTitle: string;
  publicBaseUrl: string;
  trustProxy: boolean;
  subJournalRetentionDays: number;
};

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  const v = parsed.data;
  return {
    port: v.PORT,
    databaseUrl: v.DATABASE_URL,
    adminUsername: v.ADMIN_USERNAME,
    adminPasswordHash: v.ADMIN_PASSWORD_HASH,
    sessionSecret: v.SESSION_SECRET,
    masterKey: v.MASTER_KEY,
    profileTitle: v.PROFILE_TITLE,
    publicBaseUrl: v.PUBLIC_BASE_URL,
    trustProxy: v.TRUST_PROXY,
    subJournalRetentionDays: v.SUB_JOURNAL_RETENTION_DAYS,
  };
}
