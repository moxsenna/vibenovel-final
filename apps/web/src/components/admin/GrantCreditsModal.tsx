import { useState, type FormEvent } from "react";
import { ApiClientError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { grantAdminUserCredits } from "@/services/admin";
import { Button } from "@/components/ui";

const GRANT_REASONS = [
  { value: "private_beta_bonus", label: "Bonus private beta" },
  { value: "founder_test", label: "Uji founder" },
  { value: "bug_refund", label: "Refund bug" },
  { value: "manual_correction", label: "Koreksi manual" },
] as const;

export interface GrantCreditsModalProps {
  userId: string;
  userLabel: string;
  open: boolean;
  onClose: () => void;
}

export function GrantCreditsModal({ userId, userLabel, open, onClose }: GrantCreditsModalProps) {
  const { session } = useAuth();
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState<string>(GRANT_REASONS[0].value);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      setFeedback("Jumlah kredit minimal 1.");
      return;
    }

    setSubmitting(true);
    try {
      await grantAdminUserCredits(
        userId,
        {
          amount: Math.floor(parsedAmount),
          reason,
          note: note.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        },
        session?.access_token ?? null,
      );
      setFeedback("Permintaan grant terkirim.");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 501) {
        setFeedback("Fitur dalam pengembangan oleh Codex.");
      } else if (error instanceof ApiClientError) {
        setFeedback(error.message);
      } else {
        setFeedback("Gagal mengirim grant kredit.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grant-credits-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-lg shadow-lg">
        <h2 id="grant-credits-title" className="font-headline-sm text-headline-sm text-on-surface">
          Grant Kredit
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-muted-text">Untuk {userLabel}</p>

        <form className="mt-lg flex flex-col gap-md" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 font-label-sm text-label-sm">
            Jumlah
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg border border-border bg-surface-soft px-3 py-2 font-body-md text-body-md"
              required
            />
          </label>

          <label className="flex flex-col gap-1 font-label-sm text-label-sm">
            Alasan
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-border bg-surface-soft px-3 py-2 font-body-md text-body-md"
            >
              {GRANT_REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 font-label-sm text-label-sm">
            Catatan internal
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="rounded-lg border border-border bg-surface-soft px-3 py-2 font-body-md text-body-md"
              placeholder="Opsional"
            />
          </label>

          {feedback ? (
            <p className="rounded-lg border border-border bg-surface-soft px-3 py-2 font-body-sm text-body-sm text-muted-text" role="status">
              {feedback}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Tutup
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Mengirim..." : "Grant Kredit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}