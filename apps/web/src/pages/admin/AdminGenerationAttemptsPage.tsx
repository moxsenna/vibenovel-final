import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAdminGenerationAttempts,
  type AdminGenerationAttemptListItem,
} from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

export function AdminGenerationAttemptsPage() {
  const { session } = useAuth();
  const [attempts, setAttempts] = useState<AdminGenerationAttemptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminGenerationAttempts(session?.access_token ?? null);
        if (!cancelled) setAttempts(data.attempts);
      } catch {
        if (!cancelled) {
          setAttempts([]);
          setNotice("Gagal memuat percobaan generasi.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Percobaan AI</h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">
          Operasi generasi — model/provider hanya di admin.
        </p>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat...</p>
      ) : attempts.length === 0 ? (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">Belum ada percobaan.</p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-border text-muted-text">
                <th className="px-3 py-2">Engine</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Logical model</th>
                <th className="px-3 py-2">Provider model</th>
                <th className="px-3 py-2">Fallback</th>
                <th className="px-3 py-2">Latensi</th>
                <th className="px-3 py-2">Biaya</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">Pengguna</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      to={ROUTES.admin.generationAttemptDetail(a.id)}
                      className="text-primary hover:underline"
                    >
                      {a.generationType}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{a.status}</td>
                  <td className="px-3 py-3">{a.provider ?? "—"}</td>
                  <td className="px-3 py-3">{a.logicalModel ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-text">{a.model ?? "—"}</td>
                  <td className="px-3 py-3">{a.fallbackUsed ? "Ya" : "Tidak"}</td>
                  <td className="px-3 py-3">
                    {a.providerLatencyMs !== null ? `${a.providerLatencyMs} ms` : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {a.estimatedCostUsd !== null
                      ? `$${a.estimatedCostUsd.toFixed(6)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-text">{a.errorCode ?? "—"}</td>
                  <td className="px-3 py-3">
                    <Link to={ROUTES.admin.userDetail(a.userId)} className="text-primary hover:underline">
                      {a.ownerDisplayName ?? a.ownerEmail ?? a.userId.slice(0, 8)}
                    </Link>
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