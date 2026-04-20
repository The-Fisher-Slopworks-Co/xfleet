// src/frontend/AppShell.tsx
import { Outlet } from "react-router-dom";
import { TerminalHeader } from "./components/layout/TerminalHeader";
import { Sidebar } from "./components/layout/Sidebar";

export function AppShell({ username }: { username: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TerminalHeader username={username} />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 p-6 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
