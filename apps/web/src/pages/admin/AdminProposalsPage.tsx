import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminProposals, type AdminProposalListItem } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

export function AdminProposalsPage() {
  const { session } = useAuth();
  const [proposals, setProposals] = useState<AdminProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminProposals(session?.access_token ?? null, { status: "proposed" });
        if (!cancelled) setProposals(data.proposals);
      } catch {
        if (!cancelled) {
          setProposals([]);
          setNotice("Gagal memuat proposal AI.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Proposal AI</h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">Antrian proposal status proposed.</p>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat proposal...</p>
      ) : proposals.length === 0 ? (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">Tidak ada proposal pending.</p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-border text-muted-text">
                <th className="px-3 py-2">Judul</th>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2">Risiko</th>
                <th className="px-3 py-2">Pemilik</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      to={ROUTES.admin.proposalDetail(p.id)}
                      className="text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{p.proposalType}</td>
                  <td className="px-3 py-3">{p.riskLevel}</td>
                  <td className="px-3 py-3">{p.ownerDisplayName ?? p.ownerEmail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}