import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminOverview, type AdminOverviewMetrics } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

const KPI_LABELS: { key: keyof AdminOverviewMetrics; label: string }[] = [
  { key: "totalUsers", label: "Total Pengguna" },
  { key: "totalProjects", label: "Total Proyek" },
  { key: "pendingProposals", label: "Proposal Pending" },
  { key: "failedGenerations24h", label: "Gagal AI (24j)" },
  { key: "creditsDebited24h", label: "Kredit Debit (24j)" },
  { key: "creditsRefunded24h", label: "Kredit Refund (24j)" },
];

export function AdminOverviewPage() {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotice(null);
      try {
        const data = await fetchAdminOverview(session?.access_token ?? null);
        if (!cancelled) setMetrics(data.metrics);
      } catch {
        if (!cancelled) {
          setMetrics(null);
          setNotice("Gagal memuat ringkasan admin.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Ringkasan Admin</h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">
          KPI operasional dari data live —{" "}
          <Link to={ROUTES.admin.generationAttempts} className="text-primary hover:underline">
            lihat percobaan AI
          </Link>
          .
        </p>
      </header>

      <IntegrationNotice message={notice} />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat KPI...
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {KPI_LABELS.map(({ key, label }) => (
            <Card key={key} padding="md">
              <p className="font-label-sm text-label-sm text-muted-text">{label}</p>
              <p className="mt-2 font-headline-md text-headline-md text-on-surface">
                {metrics ? String(metrics[key]) : "—"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}