import { useEffect, useState } from "react";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminSystemHealth, type AdminSystemHealthResponse } from "@/services/admin";
import { Card } from "@/components/ui";

export function AdminSystemPage() {
  const { session } = useAuth();
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminSystemHealth(session?.access_token ?? null);
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) {
          setHealth(null);
          setNotice("Gagal memuat health admin.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Sistem</h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">
          Flag lingkungan (tanpa nilai rahasia).
        </p>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat...</p>
      ) : health ? (
        <Card>
          <p className="font-body-md">
            {health.service} v{health.version}
          </p>
          <ul className="mt-md list-disc pl-5 font-body-sm text-body-sm text-muted-text">
            {Object.entries(health.env).map(([key, value]) => (
              <li key={key}>
                {key}: {String(value)}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <p className="text-muted-text">Data tidak tersedia.</p>
        </Card>
      )}
    </div>
  );
}