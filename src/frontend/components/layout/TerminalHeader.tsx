// src/frontend/components/layout/TerminalHeader.tsx
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export function TerminalHeader({ username }: { username: string }) {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <header className="border-b border-border px-4 py-2 flex items-center justify-between text-sm">
      <div className="text-primary">
        <span className="text-muted-foreground">{username}@xfleet:</span>
        <span>~{loc.pathname}</span>
        <span className="caret" />
      </div>
      <button
        className="border border-border px-2 py-1 hover:border-primary hover:text-primary"
        onClick={async () => {
          await api.post("/api/auth/logout");
          nav("/login");
        }}
      >
        [ exit ]
      </button>
    </header>
  );
}
