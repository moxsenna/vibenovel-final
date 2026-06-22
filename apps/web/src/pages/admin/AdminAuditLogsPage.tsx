import { useEffect, useState } from "react";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminAuditLogs, type AdminAuditLogItem } from "@/services/admin";
import { Card } from "@/components/ui";

export function AdminAuditLogsPage() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminAuditLogs(session?.access_token ?? null);
        if (!cancelled) setLogs(data.logs);
      } catch {
        if (!cancelled) {
          setLogs([]);
          setNotice("Gagal memuat audit log (tabel audit_logs).");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  return (
    <div className="flex w-full flex-col gap-lg">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Audit Log</h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">
          Event produk dari `audit_logs` — bukan admin_audit_logs terpisah.
        </p>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat...</p>
      ) : logs.length === 0 ? (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">Belum ada entri.</p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-border text-muted-text">
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2">Aksi</th>
                <th className="px-3 py-2">Entitas</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 whitespace-nowrap">{log.createdAt}</td>
                  <td className="px-3 py-3">{log.action}</td>
                  <td className="px-3 py-3 text-muted-text">
                    {log.entityType ?? "—"} {log.entityId ? `· ${log.entityId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}