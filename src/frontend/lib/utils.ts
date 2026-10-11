import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const p = (n: number) => String(n).padStart(2, "0");

// Renders a UTC timestamp in the admin's local timezone (the browser's) as
// `YYYY-MM-DD HH:MM:SS`, keeping a stable, locale-independent layout.
export function fmtDate(s: string): string {
  const d = new Date(s);
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

export function truncateText(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
