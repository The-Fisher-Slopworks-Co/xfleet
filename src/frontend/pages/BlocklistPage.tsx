// src/frontend/pages/BlocklistPage.tsx
import { useEffect, useState } from "react";
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
import { DeviceIdentity } from "../components/terminal/DeviceIdentity";
import { useToast } from "../components/terminal/Toasts";
import { fmtDate } from "@/lib/utils";

type IpBlockRow = { id: number; cidr: string; note: string | null; inserted_at: string };
type BlockedDeviceRow = {
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
  user: { id: number; username: string };
};

const DEVICES_PAGE_SIZE = 100;

export function BlocklistPage() {
  const ipList = useJSON<IpBlockRow[]>("/api/admin/ip-blocklist");
  const [devices, setDevices] = useState<BlockedDeviceRow[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesDone, setDevicesDone] = useState(false);
  // Keyset cursor: smallest device id fetched so far. Kept separate from the
  // rows array because unblocking removes rows — deriving the cursor from the
  // array would dead-end pagination once every loaded row is unblocked.
  const [devicesCursor, setDevicesCursor] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [cidr, setCidr] = useState("");
  const [note, setNote] = useState("");
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setDevicesLoading(true);
    api.get<BlockedDeviceRow[]>(`/api/admin/devices/blocked?limit=${DEVICES_PAGE_SIZE}`).then(r => {
      if (cancelled) return;
      setDevices(r);
      if (r.length > 0) setDevicesCursor(r[r.length - 1]!.id);
      if (r.length < DEVICES_PAGE_SIZE) setDevicesDone(true);
    }).finally(() => { if (!cancelled) setDevicesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function loadOlderDevices() {
    if (devicesCursor === null || devicesDone) return;
    setDevicesLoading(true);
    try {
      const older = await api.get<BlockedDeviceRow[]>(
        `/api/admin/devices/blocked?limit=${DEVICES_PAGE_SIZE}&before_id=${devicesCursor}`,
      );
      setDevices(prev => [...prev, ...older]);
      if (older.length > 0) setDevicesCursor(older[older.length - 1]!.id);
      if (older.length < DEVICES_PAGE_SIZE) setDevicesDone(true);
    } finally {
      setDevicesLoading(false);
    }
  }

  const addIp = useMutation(
    (body: { cidr: string; note: string | null }) => api.post("/api/admin/ip-blocklist", body),
    { onSuccess: async () => { setAddOpen(false); await ipList.refetch(); toast("ip blocked"); } },
  );
  const delIp = useMutation((blockId: number) => api.del(`/api/admin/ip-blocklist/${blockId}`), {
    onSuccess: async () => { await ipList.refetch(); toast("ip unblocked"); },
  });
  const unblockDevice = useMutation(
    (deviceId: number) => api.patch<{ id: number }>(`/api/admin/devices/${deviceId}/block`, { blocked: false }),
    {
      onSuccess: res => {
        setDevices(prev => prev.filter(r => r.id !== res.id));
        toast("device unblocked");
      },
    },
  );

  const openAdd = () => { setAddOpen(true); addIp.reset(); setCidr(""); setNote(""); };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <TypewriterTitle text="$ cat ./blocklist" />
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-primary uppercase tracking-wider">blocked ips/</h2>
          <Button onClick={openAdd}>[ + block ip ]</Button>
        </div>
        <DataTable
          columns={[
            { key: "cidr", label: "ip / cidr", render: r => <code className="text-xs">{r.cidr}</code> },
            { key: "note", label: "note", render: r => r.note ?? "—" },
            { key: "added", label: "added", render: r => <span className="font-mono text-xs whitespace-nowrap">{fmtDate(r.inserted_at)}</span> },
          ]}
          rows={ipList.data ?? []}
          emptyMessage="no blocked ips"
          rowActions={row => (
            <ConfirmButton label="unblock" confirm={`unblock ${row.cidr}?`} onConfirm={() => delIp.run(row.id)} />
          )}
        />
        {delIp.topError && <p className="text-destructive text-xs mt-2">! {delIp.topError}</p>}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-primary uppercase tracking-wider">blocked devices/</h2>
        </div>
        <DataTable
          columns={[
            {
              key: "user",
              label: "user",
              render: r => (
                <Link to={`/users/${r.user.id}`} className="text-primary hover:underline">{r.user.username}</Link>
              ),
            },
            { key: "identity", label: "identity", render: r => <DeviceIdentity device={r} /> },
            { key: "label", label: "label", render: r => r.label ?? "—" },
            { key: "last_ip", label: "last ip", render: r => <code className="text-xs">{r.last_ip ?? "—"}</code> },
            { key: "last_seen", label: "last seen", render: r => <span className="font-mono text-xs whitespace-nowrap">{fmtDate(r.last_seen_at)}</span> },
          ]}
          rows={devices}
          emptyMessage="no blocked devices"
          rowActions={row => (
            <ConfirmButton
              label="unblock"
              variant="secondary"
              confirm="unblock this device?"
              onConfirm={() => unblockDevice.run(row.id)}
            />
          )}
        />
        {unblockDevice.topError && <p className="text-destructive text-xs mt-2">! {unblockDevice.topError}</p>}
        <div className="mt-4 flex justify-center">
          {devicesLoading && <span className="text-muted-foreground text-sm">loading...</span>}
          {!devicesLoading && !devicesDone && devicesCursor !== null && (
            <Button variant="secondary" size="sm" onClick={loadOlderDevices}>[ load older ]</Button>
          )}
        </div>
      </section>

      <TerminalDialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)} title="block ip">
        <form onSubmit={e => {
          e.preventDefault();
          void addIp.run({ cidr: cidr.trim(), note: note.trim() || null });
        }}>
          <FormField label="ip / cidr" required error={addIp.fieldErrors.cidr}>
            <Input
              className="font-mono"
              placeholder="203.0.113.7 or 203.0.113.0/24"
              value={cidr}
              onChange={e => setCidr(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="note" error={addIp.fieldErrors.note}>
            <Input value={note} onChange={e => setNote(e.target.value)} />
          </FormField>
          {addIp.topError && <p className="text-destructive text-xs mb-2">! {addIp.topError}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>cancel</Button>
            <Button type="submit" disabled={addIp.loading}>{addIp.loading ? "blocking..." : "block"}</Button>
          </div>
        </form>
      </TerminalDialog>
    </>
  );
}

