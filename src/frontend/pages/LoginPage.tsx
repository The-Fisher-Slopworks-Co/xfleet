// src/frontend/pages/LoginPage.tsx
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "../components/terminal/FormField";
import { KatakanaRain } from "../components/terminal/KatakanaRain";
import { TypewriterTitle } from "../components/terminal/TypewriterTitle";
import { useMutation } from "../hooks/useMutation";

export function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { run, loading, fieldErrors, topError } = useMutation(
    (args: { username: string; password: string }) => api.post("/api/auth/login", args),
    { onSuccess: () => nav("/users", { replace: true }) },
  );

  // If already authed, bounce in
  if (typeof document !== "undefined" && document.cookie.includes("xfleet_session=")) {
    return <Navigate to="/users" replace />;
  }

  return (
    <>
      <KatakanaRain />
      <div className="relative z-10 min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md border border-border bg-card/90 backdrop-blur p-6 shadow-[0_0_24px_-4px_var(--primary)]">
          <TypewriterTitle text="ACCESS TERMINAL" className="text-center mb-6" />
          <form onSubmit={e => { e.preventDefault(); void run({ username, password }); }}>
            <FormField label="user" required error={fieldErrors.username}>
              <Input value={username} autoFocus onChange={e => setUsername(e.target.value)} autoComplete="username" />
            </FormField>
            <FormField label="pass" required error={fieldErrors.password}>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </FormField>
            {topError && <div className="text-destructive text-xs mb-3">! {topError === "unauthorized" ? "invalid credentials" : topError}</div>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "authenticating..." : "[ enter ]"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
