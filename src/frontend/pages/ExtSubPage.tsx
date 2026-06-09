// src/frontend/pages/ExtSubPage.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useJSON } from "../hooks/useJSON";
import { useMutation } from "../hooks/useMutation";
import { useLatestExtSubState } from "../hooks/useSyncEvents";
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

type SourceRow = {
  id: number; name: string;
  user_agent: string; app_version: string; device_model: string;
  ver_os: string; device_os: string; hwid: string;
  last_fetched_at: string | null; last_fetch_status: string | null;
};

type FormState = {
  name: string; url: string;
  user_agent: string; app_version: string; device_model: string;
  ver_os: string; device_os: string; hwid: string;
};

const EMPTY_FORM: FormState = {
  name: "", url: "",
  user_agent: "", app_version: "", device_model: "",
  ver_os: "", device_os: "", hwid: "",
};

export function ExtSubPage() {
  const { data, refetch } = useJSON<SourceRow[]>("/api/admin/ext-sub");
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "edit"; row: SourceRow }>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const toast = useToast();
  const { refreshingIds, lastEvent } = useLatestExtSubState();

  useEffect(() => {
    if (lastEvent?.type === "ext_sub_complete") {
      void refetch();
      if ("error" in lastEvent.result) toast(`refresh failed: ${lastEvent.result.error}`, "error");
      else {
        const s = lastEvent.result as any;
        toast(`refresh ok: +${s.inserted} -${s.deleted}`);
      }
    }
  }, [lastEvent]);

  const save = useMutation(
    (args: { method: "POST" | "PATCH"; url: string; body: any }) =>
      args.method === "POST" ? api.post(args.url, args.body) : api.patch(args.url, args.body),
    { onSuccess: async () => { setModal(null); await refetch(); toast("source saved"); } },
  );
  const del = useMutation((id: number) => api.del(`/api/admin/ext-sub/${id}`), {
    onSuccess: async () => { await refetch(); toast("source deleted"); },
  });
  const refresh = useMutation((id: number) => api.post(`/api/admin/ext-sub/${id}/refresh`), {
    onSuccess: () => toast("refresh started"),
  });

  const open = (m: typeof modal) => {
    setModal(m); save.reset();
    if (m?.kind === "edit") {
      setForm({
        name: m.row.name, url: "",
        user_agent: m.row.user_agent,
        app_version: m.row.app_version,
        device_model: m.row.device_model,
        ver_os: m.row.ver_os,
        device_os: m.row.device_os,
        hwid: m.row.hwid,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <TypewriterTitle text="$ ls ./ext-sub" />
        <Button onClick={() => open({ kind: "new" })}>[ + new source ]</Button>
      </div>

      <DataTable
        columns={[
          { key: "name", label: "name", render: r => r.name },
          { key: "ua", label: "user-agent", render: r => <code className="text-xs">{r.user_agent || "—"}</code> },
          { key: "fetched", label: "fetched", render: r => r.last_fetched_at ? fmtDate(r.last_fetched_at) : "never" },
          { key: "status", label: "status", render: r => {
            if (refreshingIds.has(r.id)) return <Badge variant="warn">refreshing</Badge>;
            if (!r.last_fetch_status) return <Badge variant="muted">—</Badge>;
            if (r.last_fetch_status === "ok") return <Badge variant="ok">ok</Badge>;
            return <div><Badge variant="err">err</Badge><div className="text-xs mt-1 text-destructive max-w-xs break-words">{r.last_fetch_status}</div></div>;
          } },
        ]}
        rows={data ?? []}
        rowActions={row => (
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="secondary" disabled={refreshingIds.has(row.id)} onClick={() => refresh.run(row.id)}>
              {refreshingIds.has(row.id) ? "refreshing..." : "refresh"}
            </Button>
            <Button size="sm" onClick={() => open({ kind: "edit", row })}>edit</Button>
            <ConfirmButton label="del" onConfirm={() => del.run(row.id)} />
          </div>
        )}
      />

      <TerminalDialog open={modal !== null} onOpenChange={v => !v && setModal(null)} title={modal?.kind === "edit" ? "edit source" : "new source"}>
        <form onSubmit={e => {
          e.preventDefault();
          const body: any = {
            name: form.name,
            user_agent: form.user_agent,
            app_version: form.app_version,
            device_model: form.device_model,
            ver_os: form.ver_os,
            device_os: form.device_os,
            hwid: form.hwid,
          };
          if (form.url) body.url = form.url;
          else if (modal?.kind === "new") body.url = "";
          if (modal?.kind === "edit") void save.run({ method: "PATCH", url: `/api/admin/ext-sub/${modal.row.id}`, body });
          else void save.run({ method: "POST", url: "/api/admin/ext-sub", body });
        }}>
          <FormField label="name" required error={save.fieldErrors.name}>
            <Input value={form.name} onChange={set("name")} autoFocus />
          </FormField>
          <FormField label={modal?.kind === "edit" ? "url (blank = keep)" : "url"} required={modal?.kind === "new"} error={save.fieldErrors.url}>
            <Input value={form.url} onChange={set("url")} placeholder="https://provider.com/sub/token" />
          </FormField>
          <FormField label="user-agent" error={save.fieldErrors.user_agent}>
            <Input value={form.user_agent} onChange={set("user_agent")} placeholder="v2raytun/android" />
          </FormField>
          <FormField label="x-app-version" error={save.fieldErrors.app_version}>
            <Input value={form.app_version} onChange={set("app_version")} placeholder="e.g. 5.x.y" />
          </FormField>
          <FormField label="x-device-model" error={save.fieldErrors.device_model}>
            <Input value={form.device_model} onChange={set("device_model")} placeholder="device model string" />
          </FormField>
          <FormField label="x-ver-os" error={save.fieldErrors.ver_os}>
            <Input value={form.ver_os} onChange={set("ver_os")} placeholder="Android API level" />
          </FormField>
          <FormField label="x-device-os" error={save.fieldErrors.device_os}>
            <Input value={form.device_os} onChange={set("device_os")} placeholder="Android" />
          </FormField>
          <FormField label="x-hwid" error={save.fieldErrors.hwid}>
            <Input value={form.hwid} onChange={set("hwid")} placeholder="hex device id" />
          </FormField>
          <p className="text-muted-foreground text-xs mt-2">blank fields are omitted from the fetch request.</p>
          {save.topError && <p className="text-destructive text-xs mb-2">! {save.topError}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>cancel</Button>
            <Button type="submit" disabled={save.loading}>{save.loading ? "saving..." : "save"}</Button>
          </div>
        </form>
      </TerminalDialog>
    </>
  );
}
