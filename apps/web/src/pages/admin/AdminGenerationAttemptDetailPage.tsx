import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAdminGenerationAttempt,
  type AdminGenerationAttemptDetailResponse,
} from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

function formatCost(value: number | null): string {
  return value !== null ? `$${value.toFixed(6)}` : "—";
}

function formatMs(value: number | null): string {
  return value !== null ? `${value} ms` : "—";
}

export function AdminGenerationAttemptDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { session } = useAuth();
  const [detail, setDetail] =
    useState<AdminGenerationAttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminGenerationAttempt(
          attemptId,
          session?.access_token ?? null,
        );
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setNotice("Gagal memuat detail percobaan.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, session?.access_token]);

  const attempt = detail?.attempt;

  return (
    <div className="flex w-full flex-col gap-lg">
      <header>
        <Link
          to={ROUTES.admin.generationAttempts}
          className="font-body-sm text-body-sm text-primary hover:underline"
        >
          ← Kembali ke daftar
        </Link>
        <h1 className="mt-2 font-headline-md text-headline-md text-on-surface">
          Detail Percobaan AI
        </h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">
          Diagnostik aman per-panggilan provider — tanpa prompt atau keluaran.
        </p>
      </header>
      <IntegrationNotice message={notice} />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat...</p>
      ) : !attempt ? (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">
            Percobaan tidak ditemukan.
          </p>
        </Card>
      ) : (
        <>
          <Card padding="md" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Summary label="Engine" value={attempt.generationType} />
            <Summary label="Status" value={attempt.status} />
            <Summary label="Provider" value={attempt.provider ?? "—"} />
            <Summary label="Logical model" value={attempt.logicalModel ?? "—"} />
            <Summary label="Provider model" value={attempt.model ?? "—"} />
            <Summary
              label="Routing policy"
              value={attempt.routingPolicyVersion ?? "—"}
            />
            <Summary
              label="Fallback"
              value={attempt.fallbackUsed ? "Ya" : "Tidak"}
            />
            <Summary label="Retry" value={String(attempt.retryCount)} />
            <Summary
              label="Latensi total"
              value={formatMs(attempt.providerLatencyMs)}
            />
            <Summary
              label="Token"
              value={`${attempt.inputTokens ?? 0} / ${attempt.outputTokens ?? 0}`}
            />
            <Summary label="Biaya" value={formatCost(attempt.estimatedCostUsd)} />
            <Summary
              label="Correlation ID"
              value={detail?.correlationId ?? "—"}
            />
          </Card>

          <Card padding="sm" className="overflow-x-auto">
            <h2 className="px-3 py-2 font-title-md text-title-md text-on-surface">
              Timeline provider
            </h2>
            {detail && detail.providerEvents.length > 0 ? (
              <table className="w-full min-w-[900px] text-left font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-border text-muted-text">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Peran</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Provider model</th>
                    <th className="px-3 py-2">Retry</th>
                    <th className="px-3 py-2">Hasil</th>
                    <th className="px-3 py-2">HTTP</th>
                    <th className="px-3 py-2">Latensi</th>
                    <th className="px-3 py-2">Token</th>
                    <th className="px-3 py-2">Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.providerEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3">{event.sequenceNumber}</td>
                      <td className="px-3 py-3">
                        {event.routeRole === "primary" ? "Primary" : "Fallback"}
                      </td>
                      <td className="px-3 py-3">{event.provider}</td>
                      <td className="px-3 py-3 text-muted-text">
                        {event.providerModelId}
                      </td>
                      <td className="px-3 py-3">{event.retryNumber}</td>
                      <td className="px-3 py-3">{event.outcome}</td>
                      <td className="px-3 py-3">
                        {event.providerHttpStatus ?? "—"}
                      </td>
                      <td className="px-3 py-3">{formatMs(event.latencyMs)}</td>
                      <td className="px-3 py-3">
                        {`${event.inputTokens ?? 0} / ${event.outputTokens ?? 0}`}
                      </td>
                      <td className="px-3 py-3">
                        {formatCost(event.estimatedCostUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-3 py-3 font-body-md text-body-md text-muted-text">
                Belum ada event provider.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body-sm text-body-sm text-muted-text">{label}</span>
      <span className="font-body-md text-body-md text-on-surface break-words">
        {value}
      </span>
    </div>
  );
}
