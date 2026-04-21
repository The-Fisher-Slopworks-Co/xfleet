// src/frontend/pages/UserDetailPage.tsx
import { useEffect, useState } from "react";
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
import { useToast } from "../components/terminal/Toasts";

type User = { id: number; username: string; token: string };
type Server = { id: number; name: string };
type ConfigRow = { id: number; user_id: number; server_id: number; config: string; tag: string | null; server: Server };
type ExtSubSource = { id: number; name: string };

export function UserDetailPage() {
  const { id } = useParams();
  const user = useJSON<User>(`/api/admin/users/${id}`);
  const configs = useJSON<ConfigRow[]>(`/api/admin/users/${id}/configs`);
  const servers = useJSON<Server[]>("/api/admin/servers");
  const extSources = useJSON<ExtSubSource[]>("/api/admin/ext-sub");
  const assignments = useJSON<{ source_ids: number[] }>(`/api/admin/users/${id}/ext-sub`);
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

      <section>
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
