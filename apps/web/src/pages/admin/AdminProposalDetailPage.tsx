import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminProposalListItem } from "@/services/admin";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminProposal } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

export function AdminProposalDetailPage() {
  const { proposalId = "" } = useParams();
  const { session } = useAuth();
  const [proposal, setProposal] = useState<AdminProposalListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!proposalId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminProposal(proposalId, session?.access_token ?? null);
        if (!cancelled) setProposal(data.proposal);
      } catch {
        if (!cancelled) {
          setProposal(null);
          setNotice("Gagal memuat proposal.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalId, session?.access_token]);

  return (
    <div className="flex w-full flex-col gap-lg">
      <header>
        <Link to={ROUTES.admin.proposals} className="font-label-sm text-primary hover:underline">
          ← Antrian proposal
        </Link>
        <h1 className="mt-2 font-headline-md text-headline-md text-on-surface">Detail Proposal</h1>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat...</p>
      ) : proposal ? (
        <Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-label-sm text-muted-text">Judul</dt>
              <dd className="font-body-md">{proposal.title}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-muted-text">Status</dt>
              <dd className="font-body-md">{proposal.status}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-muted-text">Tipe / risiko</dt>
              <dd className="font-body-md">
                {proposal.proposalType} · {proposal.riskLevel}
              </dd>
            </div>
            <div>
              <dt className="font-label-sm text-muted-text">Proyek</dt>
              <dd className="font-body-md">
                <Link
                  to={ROUTES.admin.projectDetail(proposal.projectId)}
                  className="text-primary hover:underline"
                >
                  {proposal.projectId}
                </Link>
              </dd>
            </div>
          </dl>
        </Card>
      ) : (
        <Card>
          <p className="text-muted-text">Proposal tidak ditemukan.</p>
        </Card>
      )}
    </div>
  );
}