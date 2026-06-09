// src/frontend/components/layout/Sidebar.tsx
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { to: "/users", label: "./users" },
  { to: "/servers", label: "./servers" },
  { to: "/three-x-ui", label: "./3xui" },
  { to: "/ext-sub", label: "./ext-sub" },
  { to: "/sub-journal", label: "./sub-journal" },
  { to: "/blocklist", label: "./blocklist" },
];

export function Sidebar() {
  return (
    <aside className="w-48 border-r border-border p-4 text-sm">
      <div className="text-muted-foreground uppercase text-xs mb-3">sections</div>
      <nav className="space-y-1">
        {items.map(i => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) => cn(
              "block px-2 py-1",
              isActive ? "text-primary font-bold" : "text-foreground hover:text-primary",
            )}
          >
            {({ isActive }) => (isActive ? `> ${i.label}` : `  ${i.label}`)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
