// src/shared/schemas.ts
import { z } from "zod";

export const usernameSchema = z.string().regex(/^[a-zA-Z0-9_]+$/, "must contain only letters, digits, and underscores");
export const tokenSchema = z.string().min(1);
export const tagSchema = z.string().regex(/^[a-zA-Z0-9 _.\-]+$/, "must contain only latin letters, digits, spaces, underscores, dots, and dashes");

export const userCreateSchema = z.object({
  username: usernameSchema,
  token: tokenSchema,
});
export const userUpdateSchema = userCreateSchema.partial();

export const serverCreateSchema = z.object({ name: z.string().min(1) });
export const serverUpdateSchema = serverCreateSchema.partial();

export const configCreateSchema = z.object({
  user_id: z.number().int().positive(),
  server_id: z.number().int().positive(),
  config: z.string().min(1),
  tag: tagSchema.optional().nullable(),
});
export const configUpdateSchema = configCreateSchema.partial();

const urlString = z.string().min(1);
export const threeXUiCreateSchema = z.object({
  name: z.string().min(1),
  url: urlString,
  username: z.string().min(1),
  password: z.string().min(1),
  server_id: z.number().int().positive(),
});
export const threeXUiUpdateSchema = z.object({
  name: z.string().min(1),
  url: urlString,
  username: z.string().min(1),
  password: z.string().optional(),
  server_id: z.number().int().positive(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const extSubSourceCreateSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  user_agent: z.string().default(""),
  app_version: z.string().default(""),
  device_model: z.string().default(""),
  ver_os: z.string().default(""),
  device_os: z.string().default(""),
  hwid: z.string().default(""),
});
export const extSubSourceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  user_agent: z.string().optional(),
  app_version: z.string().optional(),
  device_model: z.string().optional(),
  ver_os: z.string().optional(),
  device_os: z.string().optional(),
  hwid: z.string().optional(),
});
export const extSubAssignSchema = z.object({
  source_ids: z.array(z.number().int().positive()),
});

export type UserCreate = z.infer<typeof userCreateSchema>;
export type ServerCreate = z.infer<typeof serverCreateSchema>;
export type ConfigCreate = z.infer<typeof configCreateSchema>;
export type ThreeXUiCreate = z.infer<typeof threeXUiCreateSchema>;
export type ThreeXUiUpdate = z.infer<typeof threeXUiUpdateSchema>;
export type ExtSubSourceCreate = z.infer<typeof extSubSourceCreateSchema>;
export type ExtSubSourceUpdate = z.infer<typeof extSubSourceUpdateSchema>;
export type ExtSubAssign = z.infer<typeof extSubAssignSchema>;

export type ParsedUrl = { host: string; port: number; web_base_path: string; use_tls: boolean };

export function parseThreeXUiUrl(raw: string): ParsedUrl | { error: string } {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return { error: "invalid URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { error: "must start with http:// or https://" };
  if (!parsed.hostname) return { error: "invalid URL format" };
  const useTls = parsed.protocol === "https:";
  const port = parsed.port ? Number(parsed.port) : useTls ? 443 : 80;
  const path = parsed.pathname === "" || parsed.pathname === "/" ? "/" : parsed.pathname;
  return { host: parsed.hostname, port, web_base_path: path, use_tls: useTls };
}
