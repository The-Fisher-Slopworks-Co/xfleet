// src/frontend/pages/ThreeXUiPage.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useJSON } from "../hooks/useJSON";
import { useMutation } from "../hooks/useMutation";
import { useLatestSyncState } from "../hooks/useSyncEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TypewriterTitle } from "../components/terminal/TypewriterTitle";
import { DataTable } from "../components/terminal/DataTable";
import { TerminalDialog } from "../components/terminal/TerminalDialog";
import { FormField } from "../components/terminal/FormField";
import { ConfirmButton } from "../components/terminal/ConfirmButton";
import { Badge } from "../components/terminal/Badge";
import { useToast } from "../components/terminal/Toasts";
import { fmtDate } from "../lib/utils";

type ConfigTransform = { tag: string; port: number };
type PanelRow = {
  id: number; name: string; host: string; port: number; web_base_path: string;
  username: string; use_tls: boolean; server_id: number;
  config_transforms: ConfigTransform[];
  last_synced_at: string | null; last_sync_status: string | null;
  vpn_server: { id: number; name: string };
};
type Server = { id: number; name: string };

// Port is kept as a string while editing so the input can be cleared; coerced on submit.
type TransformRow = { tag: string; port: string };
type FormState = { name: string; url: string; username: string; password: string; server_id: number | ""; transforms: TransformRow[] };
const EMPTY_FORM: FormState = { name: "", url: "", username: "", password: "", server_id: "", transforms: [] };

export function ThreeXUiPage() {
  const { data, refetch } = useJSON<PanelRow[]>("/api/admin/three-x-ui");
  const servers = useJSON<Server[]>("/api/admin/servers");
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "edit"; row: PanelRow }>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const toast = useToast();
  const { syncingIds, lastEvent } = useLatestSyncState();

  useEffect(() => {
    if (lastEvent?.type === "sync_complete") {
      void refetch();
      if ("error" in lastEvent.result) toast(`sync failed: ${lastEvent.result.error}`, "error");
      else {
        const s = lastEvent.result as any;
        toast(`sync ok: +${s.created} ~${s.updated} -${s.deleted} users+${s.usersCreated}`);
      }
    }
  }, [lastEvent]);

  const save = useMutation(
    (args: { method: "POST" | "PATCH"; url: string; body: any }) =>
      args.method === "POST" ? api.post(args.url, args.body) : api.patch(args.url, args.body),
    { onSuccess: async () => { setModal(null); await refetch(); toast("panel saved"); } },
  );
  const del = useMutation((id: number) => api.del(`/api/admin/three-x-ui/${id}`), {
    onSuccess: async () => { await refetch(); toast("panel deleted"); },
  });
  const sync = useMutation((id: number) => api.post(`/api/admin/three-x-ui/${id}/sync`), {
    onSuccess: () => toast("sync started"),
  });

  const open = (m: typeof modal) => {
    setModal(m); save.reset();
    if (m?.kind === "edit") {
      const r = m.row;
      const scheme = r.use_tls ? "https" : "http";
      const path = r.web_base_path && r.web_base_path !== "/" ? r.web_base_path : "";
      setForm({
        name: r.name, url: `${scheme}://${r.host}:${r.port}${path}`, username: r.username,
        password: "", server_id: r.server_id,
        transforms: (r.config_transforms ?? []).map(t => ({ tag: t.tag, port: String(t.port) })),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const setTransform = (i: number, patch: Partial<TransformRow>) =>
    setForm(f => ({ ...f, transforms: f.transforms.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const addTransform = () => setForm(f => ({ ...f, transforms: [...f.transforms, { tag: "", port: "" }] }));
  const removeTransform = (i: number) => setForm(f => ({ ...f, transforms: f.transforms.filter((_, j) => j !== i) }));
  // Zod nests array errors under config_transforms / config_transforms.<i>.<field>; surface them together.
  const transformErrors = Object.entries(save.fieldErrors)
    .filter(([k]) => k === "config_transforms" || k.startsWith("config_transforms."))
    .flatMap(([, v]) => v);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <TypewriterTitle text="$ ls ./3xui" />
        <Button onClick={() => open({ kind: "new" })}>[ + new panel ]</Button>
      </div>

      <DataTable
        columns={[
          { key: "name", label: "name", render: r => r.name },
          { key: "url", label: "url", render: r => <code className="text-xs">{`${r.use_tls ? "https" : "http"}://${r.host}:${r.port}${r.web_base_path === "/" ? "" : r.web_base_path}`}</code> },
          { key: "vpn", label: "vpn server", render: r => r.vpn_server.name },
          { key: "synced", label: "synced", render: r => r.last_synced_at ? fmtDate(r.last_synced_at) : "never" },
          { key: "status", label: "status", render: r => {
            if (syncingIds.has(r.id)) return <Badge variant="warn">syncing</Badge>;
            if (!r.last_sync_status) return <Badge variant="muted">—</Badge>;
            if (r.last_sync_status === "ok") return <Badge variant="ok">ok</Badge>;
            return <div><Badge variant="err">err</Badge><div className="text-xs mt-1 text-destructive max-w-xs break-words">{r.last_sync_status}</div></div>;
          } },
        ]}
        rows={data ?? []}
        rowActions={row => (
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="secondary" disabled={syncingIds.has(row.id)} onClick={() => sync.run(row.id)}>
              {syncingIds.has(row.id) ? "syncing..." : "sync"}
            </Button>
            <Button size="sm" onClick={() => open({ kind: "edit", row })}>edit</Button>
            <ConfirmButton label="del" onConfirm={() => del.run(row.id)} />
          </div>
        )}
      />

      <TerminalDialog open={modal !== null} onOpenChange={v => !v && setModal(null)} title={modal?.kind === "edit" ? "edit panel" : "new panel"}>
        <form onSubmit={e => {
          e.preventDefault();
          const body: any = { name: form.name, url: form.url, username: form.username, server_id: Number(form.server_id) };
          body.config_transforms = form.transforms
            .filter(t => t.tag.trim() !== "" || t.port.trim() !== "")
            .map(t => ({ tag: t.tag.trim(), port: Number(t.port) }));
          if (form.password) body.password = form.password;
          else if (modal?.kind === "new") body.password = "";
          if (modal?.kind === "edit") void save.run({ method: "PATCH", url: `/api/admin/three-x-ui/${modal.row.id}`, body });
          else void save.run({ method: "POST", url: "/api/admin/three-x-ui", body });
        }}>
          <FormField label="name" required error={save.fieldErrors.name}>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
          </FormField>
          <FormField label="url" required error={save.fieldErrors.url}>
            <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://h:2053/panel" />
          </FormField>
          <FormField label="username" required error={save.fieldErrors.username}>
            <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </FormField>
          <FormField label={modal?.kind === "edit" ? "password (blank = keep)" : "password"} required={modal?.kind === "new"} error={save.fieldErrors.password}>
            <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </FormField>
          <FormField label="vpn server" required error={save.fieldErrors.server_id}>
            <select
              className="w-full bg-input border border-border px-2 py-1.5 text-sm"
              value={form.server_id}
              onChange={e => setForm({ ...form, server_id: e.target.value ? Number(e.target.value) : "" })}
            >
              <option value="">-- select --</option>
              {(servers.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <div className="mb-4">
            <span className="block text-xs uppercase tracking-wider text-primary mb-1">config transforms</span>
            <p className="text-xs text-muted-foreground mb-2">
              rewrite a config's port for every user. match by tag (the inbound remark), e.g. tag "Port443 XHTTP" → port 443.
            </p>
            {form.transforms.map((t, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <Input
                  className="flex-1 font-mono"
                  placeholder="tag (inbound remark)"
                  value={t.tag}
                  onChange={e => setTransform(i, { tag: e.target.value })}
                />
                <span className="text-muted-foreground text-xs">→</span>
                <Input
                  className="w-24 font-mono"
                  placeholder="port"
                  inputMode="numeric"
                  value={t.port}
                  onChange={e => setTransform(i, { port: e.target.value })}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => removeTransform(i)}>x</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addTransform}>[ + add transform ]</Button>
            {transformErrors.length > 0 && (
              <span className="block mt-1 text-xs text-destructive">! {transformErrors.join(", ")}</span>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>cancel</Button>
            <Button type="submit" disabled={save.loading}>{save.loading ? "saving..." : "save"}</Button>
          </div>
        </form>
      </TerminalDialog>
    </>
  );
}
