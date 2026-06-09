// src/frontend/pages/UserDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useJSON } from "../hooks/useJSON";
import { useMutation } from "../hooks/useMutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TypewriterTitle } from "../components/terminal/TypewriterTitle";
import { DataTable } from "../components/terminal/DataTable";
import { TerminalDialog } from "../components/terminal/TerminalDialog";
import { FormField } from "../components/terminal/FormField";
import { ConfirmButton } from "../components/terminal/ConfirmButton";
import { JournalStatusBadge } from "../components/terminal/JournalStatusBadge";
import { Badge } from "../components/terminal/Badge";
import { DeviceIdentity } from "../components/terminal/DeviceIdentity";
import { useSubFetchEvents, type SubFetchEventRow } from "../hooks/useSyncEvents";
import { useToast } from "../components/terminal/Toasts";
import { fmtDate } from "@/lib/utils";

type User = { id: number; username: string; token: string };
type Server = { id: number; name: string };
type ConfigRow = { id: number; user_id: number; server_id: number; config: string; tag: string | null; server: Server };
type ExtSubSource = { id: number; name: string };
type JournalRow = SubFetchEventRow;
type DeviceRow = {
  id: number;
  user_id: number;
  hwid: string | null;
  fallback_ua: string | null;
  fallback_ip: string | null;
  label: string | null;
  last_ua: string | null;
  last_ip: string | null;
  is_blocked: boolean;
  first_seen_at: string;
  last_seen_at: string;
};
const RECENT_JOURNAL_LIMIT = 10;

export function UserDetailPage() {
  const { id } = useParams();
  const user = useJSON<User>(`/api/admin/users/${id}`);
  const configs = useJSON<ConfigRow[]>(`/api/admin/users/${id}/configs`);
  const servers = useJSON<Server[]>("/api/admin/servers");
  const extSources = useJSON<ExtSubSource[]>("/api/admin/ext-sub");
  const assignments = useJSON<{ source_ids: number[] }>(`/api/admin/users/${id}/ext-sub`);
  const journal = useJSON<JournalRow[]>(`/api/admin/users/${id}/sub-journal?limit=${RECENT_JOURNAL_LIMIT}`);
  const devices = useJSON<DeviceRow[]>(`/api/admin/users/${id}/devices`);
  const [liveJournal, setLiveJournal] = useState<JournalRow[]>([]);
  useSubFetchEvents(row => {
    setLiveJournal(prev => (prev.some(r => r.id === row.id) ? prev : [row, ...prev].slice(0, RECENT_JOURNAL_LIMIT * 2)));
    if (row.user_id === Number(id)) void devices.refetch();
  });
  const recentJournal = useMemo(() => {
    const numericId = Number(id);
    const seen = new Set<number>();
    return [...liveJournal, ...(journal.data ?? [])]
      .filter(r => r.user_id === numericId)
      .filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .slice(0, RECENT_JOURNAL_LIMIT);
  }, [liveJournal, journal.data, id]);
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "edit"; row: ConfigRow }>(null);
  const [serverId, setServerId] = useState<number | "">("");
  const [config, setConfig] = useState("");
  const [tag, setTag] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());
  const toast = useToast();

  useEffect(() => {
    if (assignments.data) setSelectedSourceIds(new Set(assignments.data.source_ids));
  }, [assignments.data]);

  const save = useMutation(
    (args: { method: "POST" | "PATCH"; url: string; body: any }) =>
      args.method === "POST" ? api.post(args.url, args.body) : api.patch(args.url, args.body),
    { onSuccess: async () => { setModal(null); await configs.refetch(); toast("config saved"); } },
  );

  const del = useMutation((cfgId: number) => api.del(`/api/admin/configs/${cfgId}`), {
    onSuccess: async () => { await configs.refetch(); toast("config deleted"); },
  });

  const [renameModal, setRenameModal] = useState<DeviceRow | null>(null);
  const [labelInput, setLabelInput] = useState("");

  const toggleBlock = useMutation(
    (args: { deviceId: number; blocked: boolean }) =>
      api.patch(`/api/admin/devices/${args.deviceId}/block`, { blocked: args.blocked }),
    { onSuccess: async () => { await devices.refetch(); toast("device updated"); } },
  );

  const forgetDevice = useMutation((deviceId: number) => api.del(`/api/admin/devices/${deviceId}`), {
    onSuccess: async () => { await devices.refetch(); toast("device forgotten"); },
  });

  const renameDevice = useMutation(
    (args: { deviceId: number; label: string | null }) =>
      api.patch(`/api/admin/devices/${args.deviceId}/label`, { label: args.label }),
    { onSuccess: async () => { setRenameModal(null); await devices.refetch(); toast("device renamed"); } },
  );

  const openRename = (d: DeviceRow) => {
    setRenameModal(d);
    renameDevice.reset();
    setLabelInput(d.label ?? "");
  };

  const saveAssignments = useMutation(
    (sourceIds: number[]) => api.put(`/api/admin/users/${id}/ext-sub`, { source_ids: sourceIds }),
    { onSuccess: async () => { setAssignModalOpen(false); await assignments.refetch(); toast("sources updated"); } },
  );

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    saveAssignments.reset();
    if (assignments.data) setSelectedSourceIds(new Set(assignments.data.source_ids));
  };

  const open = (m: typeof modal) => {
    setModal(m);
    save.reset();
    if (m?.kind === "edit") { setServerId(m.row.server_id); setConfig(m.row.config); setTag(m.row.tag ?? ""); }
    else { setServerId(""); setConfig(""); setTag(""); }
  };

  const toggleSource = (sid: number) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const assignedSources = (extSources.data ?? []).filter(s => (assignments.data?.source_ids ?? []).includes(s.id));

  if (!user.data) return <div className="text-muted-foreground">loading...</div>;
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <TypewriterTitle text={`$ cat ./users/${user.data.username}`} />
          <div className="text-muted-foreground text-sm mt-1">
            id={user.data.id} · token=<code>{user.data.token}</code>
          </div>
        </div>
        <Link to="/users"><Button variant="secondary">[ ../users ]</Button></Link>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-primary uppercase tracking-wider">configs/</h2>
          <Button onClick={() => open({ kind: "new" })}>[ + new config ]</Button>
        </div>
        <DataTable
          columns={[
            { key: "server", label: "server", render: r => r.server.name },
            { key: "config", label: "config", render: r => <code className="text-xs break-all">{r.config.slice(0, 60)}{r.config.length > 60 ? "..." : ""}</code> },
            { key: "tag", label: "tag", render: r => r.tag ?? "—" },
          ]}
          rows={configs.data ?? []}
          rowActions={row => (
            <div className="flex gap-1 justify-end">
              <Button size="sm" onClick={() => open({ kind: "edit", row })}>edit</Button>
              <ConfirmButton label="del" onConfirm={() => del.run(row.id)} />
            </div>
          )}
        />
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-primary uppercase tracking-wider">ext-sub sources/</h2>
          <Button onClick={() => setAssignModalOpen(true)}>[ manage ]</Button>
        </div>
        <DataTable
          columns={[
            { key: "name", label: "name", render: r => r.name },
          ]}
          rows={assignedSources}
          emptyMessage="no sources assigned"
        />
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-primary uppercase tracking-wider">devices/</h2>
        </div>
        <DataTable
          columns={[
            { key: "identity", label: "identity", render: r => <DeviceIdentity device={r} /> },
            { key: "label", label: "label", render: r => r.label ?? "—" },
            { key: "last_ip", label: "last ip", render: r => <code className="text-xs">{r.last_ip ?? "—"}</code> },
            {
              key: "last_seen",
              label: "last seen",
              render: r => (
                <span className="font-mono text-xs whitespace-nowrap">{fmtDate(r.last_seen_at)}</span>
              ),
            },
            {
              key: "status",
              label: "status",
              render: r => r.is_blocked ? <Badge variant="err">blocked</Badge> : <Badge variant="ok">active</Badge>,
            },
          ]}
          rows={devices.data ?? []}
          emptyMessage="no devices seen yet"
          rowActions={row => (
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="secondary" onClick={() => openRename(row)}>label</Button>
              <ConfirmButton
                label={row.is_blocked ? "unblock" : "block"}
                variant={row.is_blocked ? "secondary" : "destructive"}
                confirm={row.is_blocked ? "unblock this device?" : "block this device?"}
                onConfirm={() => toggleBlock.run({ deviceId: row.id, blocked: !row.is_blocked })}
              />
              <ConfirmButton
                label="forget"
                confirm="forget this device? it will reappear on its next fetch."
                onConfirm={() => forgetDevice.run(row.id)}
              />
            </div>
          )}
        />
        {(toggleBlock.topError || forgetDevice.topError) && (
          <p className="text-destructive text-xs mt-2">! {toggleBlock.topError ?? forgetDevice.topError}</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-primary uppercase tracking-wider">recent fetches/</h2>
          <Link to={`/sub-journal?user_id=${id}`}>
            <Button variant="secondary" size="sm">[ view all ]</Button>
          </Link>
        </div>
        <DataTable
          columns={[
            {
              key: "time",
              label: "time",
              render: r => (
                <span className="font-mono text-xs whitespace-nowrap">
                  {new Date(r.inserted_at).toISOString().slice(0, 19).replace("T", " ")}
                </span>
              ),
            },
            {
              key: "status",
              label: "status",
              render: r => r.blocked_by
                ? <Badge variant="err">{r.status_code} blocked/{r.blocked_by}</Badge>
                : <JournalStatusBadge code={r.status_code} />,
            },
            { key: "ip", label: "ip", render: r => <code className="text-xs">{r.ip ?? "—"}</code> },
            {
              key: "ua",
              label: "user-agent",
              render: r => (
                <span className="text-xs break-all">
                  {r.user_agent ? (r.user_agent.length > 60 ? r.user_agent.slice(0, 60) + "…" : r.user_agent) : "—"}
                </span>
              ),
            },
          ]}
          rows={recentJournal}
          emptyMessage="no fetches recorded"
        />
      </section>

      <TerminalDialog
        open={modal !== null}
        onOpenChange={v => !v && setModal(null)}
        title={modal?.kind === "edit" ? "edit config" : "new config"}
      >
        <form onSubmit={e => {
          e.preventDefault();
          const body = { server_id: Number(serverId), config, tag: tag || null };
          if (modal?.kind === "edit") void save.run({ method: "PATCH", url: `/api/admin/configs/${modal.row.id}`, body });
          else void save.run({ method: "POST", url: `/api/admin/users/${id}/configs`, body });
        }}>
          <FormField label="server" required error={save.fieldErrors.server_id}>
            <select
              className="w-full bg-input border border-border px-2 py-1.5 text-sm"
              value={serverId}
              onChange={e => setServerId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">-- select --</option>
              {(servers.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="config" required error={save.fieldErrors.config}>
            <Input className="font-mono" value={config} onChange={e => setConfig(e.target.value)} />
          </FormField>
          <FormField label="tag" error={save.fieldErrors.tag}>
            <Input value={tag} onChange={e => setTag(e.target.value)} />
          </FormField>
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>cancel</Button>
            <Button type="submit" disabled={save.loading}>{save.loading ? "saving..." : "save"}</Button>
          </div>
        </form>
      </TerminalDialog>

      <TerminalDialog
        open={renameModal !== null}
        onOpenChange={v => !v && setRenameModal(null)}
        title="device label"
      >
        <form onSubmit={e => {
          e.preventDefault();
          if (renameModal) void renameDevice.run({ deviceId: renameModal.id, label: labelInput.trim() || null });
        }}>
          <FormField label="label" error={renameDevice.fieldErrors.label}>
            <Input value={labelInput} onChange={e => setLabelInput(e.target.value)} autoFocus />
          </FormField>
          {renameDevice.topError && <p className="text-destructive text-xs mb-2">! {renameDevice.topError}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={() => setRenameModal(null)}>cancel</Button>
            <Button type="submit" disabled={renameDevice.loading}>{renameDevice.loading ? "saving..." : "save"}</Button>
          </div>
        </form>
      </TerminalDialog>

      <TerminalDialog
        open={assignModalOpen}
        onOpenChange={v => { if (!v) closeAssignModal(); }}
        title="assign ext-sub sources"
      >
        <div className="space-y-1 mb-4">
          {(extSources.data ?? []).length === 0 && (
            <div className="text-muted-foreground text-sm">no sources exist. create one in ./ext-sub first.</div>
          )}
          {(extSources.data ?? []).map(s => (
            <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/40 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSourceIds.has(s.id)}
                onChange={() => toggleSource(s.id)}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        {saveAssignments.topError && (
          <p className="text-destructive text-xs mb-2">! {saveAssignments.topError}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={closeAssignModal}>cancel</Button>
          <Button
            type="button"
            disabled={saveAssignments.loading}
            onClick={() => void saveAssignments.run(Array.from(selectedSourceIds))}
          >
            {saveAssignments.loading ? "saving..." : "save"}
          </Button>
        </div>
      </TerminalDialog>
    </>
  );
}

