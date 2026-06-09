// src/frontend/pages/UsersPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
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
import { CopyButton } from "../components/terminal/CopyButton";
import { useToast } from "../components/terminal/Toasts";
import { fmtDate } from "../lib/utils";

type UserRow = { id: number; username: string; token: string; inserted_at: string };

export function UsersPage() {
  const { data: users, refetch } = useJSON<UserRow[]>("/api/admin/users");
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "edit"; row: UserRow }>(null);
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const toast = useToast();

  const save = useMutation(
    (args: { method: "POST" | "PATCH"; url: string; body: any }) =>
      args.method === "POST" ? api.post(args.url, args.body) : api.patch(args.url, args.body),
    { onSuccess: async () => { setModal(null); await refetch(); toast("user saved"); } },
  );

  const del = useMutation((id: number) => api.del(`/api/admin/users/${id}`), {
    onSuccess: async () => { await refetch(); toast("user deleted"); },
  });

  const open = (m: typeof modal) => {
    setModal(m);
    save.reset();
    if (m?.kind === "edit") { setUsername(m.row.username); setToken(m.row.token); }
    else { setUsername(""); setToken(""); }
  };

  async function generate() {
    const r = await api.post<{ token: string }>("/api/admin/users/generate-token");
    setToken(r.token);
  }

  function subUrl(t: string) {
    return `${window.location.origin}/sub/${t}`;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <TypewriterTitle text="$ ls ./users" />
        <Button onClick={() => open({ kind: "new" })}>[ + new user ]</Button>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID", render: r => r.id },
          { key: "username", label: "username", render: r => r.username },
          { key: "token", label: "token", render: r => <code className="text-xs">{r.token}</code> },
          { key: "created", label: "created", render: r => fmtDate(r.inserted_at) },
        ]}
        rows={users ?? []}
        rowActions={row => (
          <div className="flex gap-1 justify-end">
            <CopyButton text={subUrl(row.token)} label="url" />
            <Link to={`/users/${row.id}`}><Button size="sm" variant="secondary">view</Button></Link>
            <Button size="sm" onClick={() => open({ kind: "edit", row })}>edit</Button>
            <ConfirmButton label="del" onConfirm={() => del.run(row.id)} />
          </div>
        )}
      />

      <TerminalDialog
        open={modal !== null}
        onOpenChange={v => !v && setModal(null)}
        title={modal?.kind === "edit" ? "edit user" : "new user"}
      >
        <form onSubmit={e => {
          e.preventDefault();
          if (modal?.kind === "edit") void save.run({ method: "PATCH", url: `/api/admin/users/${modal.row.id}`, body: { username, token } });
          else void save.run({ method: "POST", url: "/api/admin/users", body: { username, token } });
        }}>
          <FormField label="username" required error={save.fieldErrors.username}>
            <Input value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </FormField>
          <FormField label="token" required error={save.fieldErrors.token}>
            <div className="flex gap-2">
              <Input className="flex-1 font-mono" value={token} onChange={e => setToken(e.target.value)} />
              <Button type="button" variant="secondary" onClick={generate}>generate</Button>
            </div>
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
