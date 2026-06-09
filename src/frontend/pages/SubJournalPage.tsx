// src/frontend/pages/SubJournalPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { TypewriterTitle } from "../components/terminal/TypewriterTitle";
import { JournalStatusBadge } from "../components/terminal/JournalStatusBadge";
import { Badge } from "../components/terminal/Badge";
import { useSubFetchEvents, type SubFetchEventRow } from "../hooks/useSyncEvents";
import { fmtDate } from "../lib/utils";

type JournalRow = SubFetchEventRow;

const PAGE_SIZE = 200;

export function SubJournalPage() {
  const [params, setParams] = useSearchParams();
  const userIdParam = params.get("user_id");
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const baseUrl = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", String(PAGE_SIZE));
    if (userIdParam) qs.set("user_id", userIdParam);
    return `/api/admin/sub-journal?${qs.toString()}`;
  }, [userIdParam]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDone(false);
    setRows([]);
    setExpanded(new Set());
    api.get<JournalRow[]>(baseUrl).then(r => {
      if (cancelled) return;
      setRows(r);
      if (r.length < PAGE_SIZE) setDone(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [baseUrl]);

  const userFilter = userIdParam ? Number(userIdParam) : null;
  useSubFetchEvents(row => {
    if (userFilter !== null && row.user_id !== userFilter) return;
    setRows(prev => (prev.some(r => r.id === row.id) ? prev : [row, ...prev]));
  });

  async function loadOlder() {
    if (rows.length === 0) return;
    const beforeId = rows[rows.length - 1]!.id;
    setLoading(true);
    try {
      const older = await api.get<JournalRow[]>(`${baseUrl}&before_id=${beforeId}`);
      setRows(prev => [...prev, ...older]);
      if (older.length < PAGE_SIZE) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearFilter() {
    const next = new URLSearchParams(params);
    next.delete("user_id");
    setParams(next, { replace: true });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TypewriterTitle text="$ tail ./sub-journal" />
          <span className="text-primary text-xs uppercase tracking-wider" title="streaming live">
            <span className="inline-block size-1.5 bg-primary rounded-full mr-1 animate-pulse" />
            live
          </span>
        </div>
        {userIdParam && (
          <Button variant="secondary" size="sm" onClick={clearFilter}>[ clear user filter ]</Button>
        )}
      </div>

      {rows.length === 0 && !loading && (
        <div className="text-muted-foreground py-12 text-center">no fetches recorded yet</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2 font-medium text-primary uppercase tracking-wider text-xs">time</th>
                <th className="text-left px-3 py-2 font-medium text-primary uppercase tracking-wider text-xs">user</th>
                <th className="text-left px-3 py-2 font-medium text-primary uppercase tracking-wider text-xs">status</th>
                <th className="text-left px-3 py-2 font-medium text-primary uppercase tracking-wider text-xs">ip</th>
                <th className="text-left px-3 py-2 font-medium text-primary uppercase tracking-wider text-xs">user-agent</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <RowView
                  key={r.id}
                  row={r}
                  expanded={expanded.has(r.id)}
                  striped={i % 2 === 1}
                  onToggle={() => toggleRow(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-center">
        {loading && <span className="text-muted-foreground text-sm">loading...</span>}
        {!loading && !done && rows.length > 0 && (
          <Button variant="secondary" size="sm" onClick={loadOlder}>[ load older ]</Button>
        )}
        {done && rows.length > 0 && (
          <span className="text-muted-foreground text-xs">— end of journal —</span>
        )}
      </div>
    </>
  );
}

function RowView(props: {
  row: JournalRow;
  expanded: boolean;
  striped: boolean;
  onToggle: () => void;
}) {
  const { row, expanded, striped, onToggle } = props;
  return (
    <>
      <tr className={`border-b border-border/50 hover:bg-muted/40 ${striped ? "bg-muted/10" : ""}`}>
        <td className="px-3 py-2 align-top whitespace-nowrap font-mono text-xs">
          {fmtDate(row.inserted_at)}
        </td>
        <td className="px-3 py-2 align-top">
          {row.user ? (
            <Link to={`/users/${row.user.id}`} className="text-primary hover:underline">
              {row.user.username}
            </Link>
          ) : (
            <span className="text-muted-foreground">— unknown —</span>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {row.blocked_by ? (
            <Badge variant="err">{row.status_code} blocked/{row.blocked_by}</Badge>
          ) : (
            <JournalStatusBadge code={row.status_code} />
          )}
        </td>
        <td className="px-3 py-2 align-top font-mono text-xs">{row.ip ?? "—"}</td>
        <td className="px-3 py-2 align-top text-xs">
          <span className="break-all">{truncate(row.user_agent, 80)}</span>
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <Button size="sm" variant="secondary" onClick={onToggle}>
            {expanded ? "hide" : "headers"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className={`border-b border-border/50 ${striped ? "bg-muted/10" : ""}`}>
          <td colSpan={6} className="px-3 py-3">
            <div className="text-muted-foreground text-xs mb-1">
              attempted_token: <code className="text-foreground">{row.attempted_token}</code>
            </div>
            <pre className="text-xs bg-muted/40 border border-border p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(row.headers, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
