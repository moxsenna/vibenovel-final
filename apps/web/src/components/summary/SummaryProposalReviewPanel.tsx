import { Button } from "@/components/ui";
import type { LinkedProposalSummary } from "@/services/summary";

const TYPE_LABELS: Record<string, string> = {
  fact: "Usulan Fakta",
  character_update: "Perubahan Tokoh",
  relationship_update: "Perubahan Relasi",
  open_loop_update: "Open Loop",
  reveal_status_update: "Reveal",
};

function proposalExcerpt(proposal: LinkedProposalSummary): string {
  const excerpt = proposal.payloadExcerpt;
  const candidates = [
    proposal.summary,
    typeof excerpt.proposedFactText === "string" ? excerpt.proposedFactText : null,
    typeof excerpt.changeSummary === "string" ? excerpt.changeSummary : null,
    proposal.title,
  ];
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c.trim();
  }
  return "Usulan perubahan canon — tinjau sebelum menerima.";
}

export interface SummaryProposalReviewPanelProps {
  proposals: LinkedProposalSummary[];
  isApproved: boolean;
  actionProposalId: string | null;
  actionError: string | null;
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

export function SummaryProposalReviewPanel({
  proposals,
  isApproved,
  actionProposalId,
  actionError,
  onAccept,
  onReject,
}: SummaryProposalReviewPanelProps) {
  if (proposals.length === 0) {
    return (
      <p className="font-body-sm text-body-sm text-muted-text">
        Belum ada usulan perubahan canon. Ekstrak perubahan cerita setelah ringkasan dibuat.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!isApproved ? (
        <p className="font-body-sm text-body-sm text-muted-text">
          Setujui ringkasan bab terlebih dahulu sebelum menerima usulan ke canon.
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 font-body-sm text-body-sm text-on-surface">
          {actionError}
        </p>
      ) : null}

      {proposals.map((proposal) => {
        const isProposed = proposal.status === "proposed" && proposal.linkStatus === "linked";
        const isReveal = proposal.type === "reveal_status_update";
        const needsManualConfirm = isReveal && proposal.riskLevel === "high";
        const busy = actionProposalId === proposal.proposalId;

        return (
          <article
            key={proposal.proposalId}
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-label text-label text-primary">
                {TYPE_LABELS[proposal.type] ?? proposal.type}
              </span>
              <span className="rounded-md bg-surface-variant px-2 py-0.5 font-label text-label text-muted-text">
                {proposal.riskLevel}
              </span>
              <span className="rounded-md bg-surface-variant px-2 py-0.5 font-label text-label text-muted-text">
                {proposal.status}
              </span>
              {needsManualConfirm ? (
                <span className="rounded-md bg-warning-soft px-2 py-0.5 font-label text-label text-warning">
                  Butuh konfirmasi manual
                </span>
              ) : null}
            </div>

            <p className="font-body-md text-body-md font-medium text-on-surface">
              {proposal.title}
            </p>
            <p className="mt-1 font-body-sm text-body-sm text-muted-text">
              {proposalExcerpt(proposal)}
            </p>

            {needsManualConfirm ? (
              <p className="mt-2 font-body-sm text-body-sm text-muted-text">
                Usulan reveal berisiko tinggi — konfirmasi manual belum tersedia di UI ini. Tolak
                atau tinjau di langkah berikutnya.
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!isApproved || !isProposed || busy || needsManualConfirm}
                onClick={() => onAccept(proposal.proposalId)}
              >
                {busy ? "Memproses…" : "Terima"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!isProposed || busy}
                onClick={() => onReject(proposal.proposalId)}
              >
                Tolak
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}