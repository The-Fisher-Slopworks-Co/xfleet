// src/frontend/pages/ServersPage.tsx
import { useState } from "react";
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
import { fmtDate } from "../lib/utils";

type ServerRow = { id: number; name: string; inserted_at: string };

export function ServersPage() {
  const { data, refetch } = useJSON<ServerRow[]>("/api/admin/servers");
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "edit"; row: ServerRow }>(null);
  const [name, setName] = useState("");
  const toast = useToast();

  const save = useMutation(
    (args: { method: "POST" | "PATCH"; url: string; body: any }) =>
      args.method === "POST" ? api.post(args.url, args.body) : api.patch(args.url, args.body),
    { onSuccess: async () => { setModal(null); await refetch(); toast("server saved"); } },
  );
  const del = useMutation((id: number) => api.del(`/api/admin/servers/${id}`), {
    onSuccess: async () => { await refetch(); toast("server deleted"); },
  });

  const open = (m: typeof modal) => { setModal(m); save.reset(); setName(m?.kind === "edit" ? m.row.name : ""); };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <TypewriterTitle text="$ ls ./servers" />
        <Button onClick={() => open({ kind: "new" })}>[ + new server ]</Button>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID", render: r => r.id },
          { key: "name", label: "name", render: r => r.name },
          { key: "created", label: "created", render: r => fmtDate(r.inserted_at) },
        ]}
        rows={data ?? []}
        rowActions={row => (
          <div className="flex gap-1 justify-end">
            <Button size="sm" onClick={() => open({ kind: "edit", row })}>edit</Button>
            <ConfirmButton label="del" onConfirm={() => del.run(row.id)} />
          </div>
        )}
      />

      <TerminalDialog open={modal !== null} onOpenChange={v => !v && setModal(null)} title={modal?.kind === "edit" ? "edit server" : "new server"}>
        <form onSubmit={e => {
          e.preventDefault();
          if (modal?.kind === "edit") void save.run({ method: "PATCH", url: `/api/admin/servers/${modal.row.id}`, body: { name } });
          else void save.run({ method: "POST", url: "/api/admin/servers", body: { name } });
        }}>
          <FormField label="name" required error={save.fieldErrors.name}>
            <Input value={name} autoFocus onChange={e => setName(e.target.value)} />
          </FormField>
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>cancel</Button>
            <Button type="submit" disabled={save.loading}>{save.loading ? "saving..." : "save"}</Button>
          </div>
        </form>
      </TerminalDialog>
    </>
  );
}
