import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { ROUTES } from "@/routes/paths";
import { fetchCreditBalance, toCreditTopupUserMessage } from "@/services/credits";

function formatOrderId(value: string | null): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…`;
}

export function CreditTopupReturnPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;
  const useMocks = shouldUseMocks();

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!token) {
      setBalanceError("Silakan login ulang.");
      return;
    }
    setBalanceLoading(true);
    setBalanceError(null);
    setRefreshNotice(null);
    try {
      const row = await fetchCreditBalance(token);
      setBalance(row?.balance ?? 0);
      setRefreshNotice("Saldo diperbarui. Jika kredit belum masuk, tunggu beberapa saat lalu coba lagi.");
    } catch (error) {
      setBalanceError(toCreditTopupUserMessage(error));
    } finally {
      setBalanceLoading(false);
    }
  }, [token]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-lg">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-display-lg text-on-surface">Pembayaran Sedang Diverifikasi</h1>
        <p className="font-body-md text-body-md text-muted-text">
          Kredit akan masuk setelah notifikasi pembayaran diterima oleh server.
        </p>
      </div>

      <Card padding="md" className="rounded-2xl border border-border bg-surface">
        <p className="font-body-sm text-body-sm text-muted-text">Referensi pesanan</p>
        <p className="mt-1 font-body-md text-body-md text-on-surface">{formatOrderId(orderId)}</p>
        <p className="mt-4 font-body-sm text-body-sm text-muted-text">
          Halaman ini tidak menandai pembayaran sebagai lunas. Grant kredit hanya terjadi melalui
          notifikasi pembayaran server (callback/webhook), bukan dari redirect browser.
        </p>
      </Card>

      {useMocks ? (
        <Card padding="md" className="rounded-2xl border border-border bg-surface-soft">
          <p className="font-body-sm text-body-sm text-muted-text">
            Mode mock: uji alur lengkap memerlukan API mode dan smoke test yang mem-post webhook ke
            server.
          </p>
        </Card>
      ) : null}

      <Card padding="md" className="rounded-2xl border border-border bg-surface-soft">
        <p className="font-label-sm text-label-sm uppercase tracking-wider text-muted-text">
          Saldo kredit
        </p>
        <p className="mt-2 font-display text-display text-primary">
          {authLoading || balanceLoading
            ? "…"
            : balanceError
              ? "—"
              : balance != null
                ? balance.toLocaleString("id-ID")
                : "—"}
        </p>
        {balanceError ? (
          <p className="mt-2 font-body-sm text-body-sm text-warning">{balanceError}</p>
        ) : null}
        {refreshNotice ? (
          <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">{refreshNotice}</p>
        ) : null}
        <Button
          variant="secondary"
          className="mt-4"
          disabled={balanceLoading || authLoading || !token}
          onClick={() => void refreshBalance()}
        >
          {balanceLoading ? "Memuat…" : "Refresh Saldo"}
        </Button>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to={ROUTES.dashboard}>
          <Button variant="ghost">Kembali ke Dashboard</Button>
        </Link>
        <Link to={ROUTES.creditTopup}>
          <Button variant="primary">Lihat Paket Kredit</Button>
        </Link>
      </div>
    </div>
  );
}