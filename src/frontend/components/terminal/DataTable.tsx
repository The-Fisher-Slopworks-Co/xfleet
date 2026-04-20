// src/frontend/components/terminal/DataTable.tsx
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: number }>(props: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowActions?: (row: T) => React.ReactNode;
}) {
  if (props.rows.length === 0) {
    return <div className="text-muted-foreground py-12 text-center">{props.emptyMessage ?? "no records"}</div>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {props.columns.map(c => (
              <th key={c.key} className={cn("text-left px-3 py-2 font-medium text-primary uppercase tracking-wider text-xs", c.className)}>
                {c.label}
              </th>
            ))}
            {props.rowActions && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={row.id} className={cn("border-b border-border/50 hover:bg-muted/40", i % 2 ? "bg-muted/10" : "")}>
              {props.columns.map(c => (
                <td key={c.key} className={cn("px-3 py-2 align-top", c.className)}>{c.render(row)}</td>
              ))}
              {props.rowActions && (
                <td className="px-3 py-2 text-right whitespace-nowrap">{props.rowActions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
