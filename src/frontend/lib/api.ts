// src/frontend/lib/api.ts
export type ApiError = { errors: Record<string, string[]> } | { error: string };

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const data = res.status !== 204 ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw { status: res.status, body: data as ApiError };
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
