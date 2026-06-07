import type { UiFoundationProposal } from "@/lib/api-mappers";
import { Badge, Button, Card, Icon } from "@/components/ui";

export interface FoundationProposalsPanelProps {
  proposals: UiFoundationProposal[];
  generating?: boolean;
  acceptingId?: string | null;
  onGenerate?: () => void | Promise<void>;
  onAccept?: (proposalId: string) => void | Promise<void>;
}

const STATUS_LABELS: Record<string, string> = {
  proposed: "Menunggu",
  accepted: "Diterima",
  rejected: "Ditolak",
  merged: "Digabung",
};

export function FoundationProposalsPanel({
  proposals,
  generating = false,
  acceptingId = null,
  onGenerate,
  onAccept,
}: FoundationProposalsPanelProps) {
  return (
    <Card padding="lg" className="rounded-[20px] border-border/50 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Icon name="lightbulb" size={22} className="text-primary" />
          <h3 className="font-headline-md text-headline-md text-on-surface">Usulan Cerita</h3>
        </div>
        {onGenerate && (
          <Button
            variant="secondary"
            className="rounded-xl"
            disabled={generating}
            onClick={() => void onGenerate()}
          >
            {generating ? "Membuat usulan..." : "Buat Usulan Fondasi"}
          </Button>
        )}
      </div>

      {proposals.length === 0 ? (
        <p className="font-body-sm text-body-sm text-muted-text">
          Belum ada usulan. Buat usulan fondasi dari konsep terpilih.
        </p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((proposal) => {
            const canAccept =
              onAccept &&
              proposal.status === "proposed" &&
              proposal.proposalType !== "Rahasia" &&
              proposal.proposalType !== "Pengungkapan" &&
              !(proposal.proposalType === "Fakta" && proposal.riskLevel === "high");

            return (
              <li
                key={proposal.id}
                className="rounded-xl border border-border bg-surface-soft p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-label-sm text-label-sm text-muted-text">
                      {proposal.proposalType}
                      {proposal.riskLevel === "high" ? " · Risiko tinggi" : ""}
                    </p>
                    <p className="font-body-md text-body-md text-on-surface">{proposal.title}</p>
                    {proposal.summary && (
                      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                        {proposal.summary}
                      </p>
                    )}
                  </div>
                  <Badge variant="neutral" className="rounded-full">
                    {STATUS_LABELS[proposal.status] ?? proposal.status}
                  </Badge>
                </div>
                {canAccept && (
                  <Button
                    variant="secondary"
                    className="mt-3 rounded-lg text-sm"
                    disabled={acceptingId === proposal.id}
                    onClick={() => void onAccept(proposal.id)}
                  >
                    {acceptingId === proposal.id ? "Menerima..." : "Terima Usulan"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}