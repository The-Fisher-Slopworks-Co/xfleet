// src/frontend/AuthGate.tsx
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "./lib/api";
import { AppShell } from "./AppShell";

export function AuthGate() {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "anon" } | { kind: "auth"; username: string }>({ kind: "loading" });
  useEffect(() => {
    api.get<{ username: string }>("/api/auth/me")
      .then(r => setState({ kind: "auth", username: r.username }))
      .catch(() => setState({ kind: "anon" }));
  }, []);
  if (state.kind === "loading") return <div className="p-6 text-muted-foreground">booting...</div>;
  if (state.kind === "anon") return <Navigate to="/login" replace />;
  return <AppShell username={state.username} />;
}
