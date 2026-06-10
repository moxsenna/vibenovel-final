import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CreditTopupProduct } from "@vibenovel/shared";
import { Badge, Button, Card } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { ROUTES } from "@/routes/paths";
import {
  buildTopupIdempotencyKey,
  createCreditTopupCheckout,
  fetchApiHealthFlags,
  fetchCreditBalance,
  fetchCreditTopupProducts,
  toCreditTopupUserMessage,
  type CreditTopupProductSlug,
} from "@/services/credits";

const PACKAGE_LABELS: Record<CreditTopupProductSlug, string> = {
  starter: "Starter",
  creator: "Creator",
  pro: "Pro",
  studio: "Studio",
};

function formatPriceIdr(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function formatCreditsLine(product: CreditTopupProduct): string {
  if (product.bonusCredits > 0) {
    return `${product.credits} kredit + ${product.bonusCredits} bonus`;
  }
  return `${product.credits} kredit`;
}

function isRecommended(product: CreditTopupProduct): boolean {
  const meta = product.metadata as { recommended?: boolean } | null;
  return Boolean(meta?.recommended) || product.slug === "creator";
}

export function CreditTopupPage() {
  const { session, loading: authLoading, isConfigured } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [topupEnabled, setTopupEnabled] = useState<boolean | null>(null);
  const [products, setProducts] = useState<CreditTopupProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<CreditTopupProductSlug | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder),
    [products],
  );

  const loadBalance = useCallback(async () => {
    if (!token) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const row = await fetchCreditBalance(token);
      setBalance(row?.balance ?? 0);
    } catch (error) {
      setBalanceError(toCreditTopupUserMessage(error));
    } finally {
      setBalanceLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (useMocks) return;
    let cancelled = false;
    void fetchApiHealthFlags().then((flags) => {
      if (!cancelled) setTopupEnabled(flags.creditTopupEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, [useMocks]);

  useEffect(() => {
    if (useMocks || !token || topupEnabled !== true) return;

    let cancelled = false;
    setProductsLoading(true);
    setPageError(null);

    void (async () => {
      try {
        const rows = await fetchCreditTopupProducts(token);
        if (!cancelled) setProducts(rows);
      } catch (error) {
        if (!cancelled) setPageError(toCreditTopupUserMessage(error));
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, topupEnabled, useMocks]);

  useEffect(() => {
    if (!token || useMocks) return;
    void loadBalance();
  }, [loadBalance, token, useMocks]);

  const handleCheckout = async (slug: CreditTopupProductSlug) => {
    if (!token || useMocks || topupEnabled !== true) return;
    setCheckoutSlug(slug);
    setCheckoutError(null);
    try {
      const result = await createCreditTopupCheckout(
        { productSlug: slug, idempotencyKey: buildTopupIdempotencyKey() },
        token,
      );
      if (!result.paymentUrl) {
        throw new Error("Payment URL tidak tersedia.");
      }
      window.location.assign(result.paymentUrl);
    } catch (error) {
      setCheckoutError(toCreditTopupUserMessage(error));
      setCheckoutSlug(null);
    }
  };

  const showLoginNotice = isConfigured && !authLoading && !token;
  const showMockNotice = useMocks;
  const showDisabledNotice = !useMocks && topupEnabled === false;
  const showReady = !useMocks && Boolean(token) && topupEnabled === true;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-lg">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-display-lg text-on-surface">Top Up Kredit</h1>
        <p className="font-body-md text-body-md text-muted-text">
          Beli paket kredit untuk fitur AI di Ruang Tulis dan Publish.
        </p>
      </div>

      <Card padding="md" className="rounded-2xl border border-border bg-surface">
        <p className="font-label-sm text-label-sm uppercase tracking-wider text-muted-text">
          Saldo saat ini
        </p>
        <p className="mt-2 font-display text-display text-primary">
          {showMockNotice
            ? "—"
            : balanceLoading
              ? "…"
              : balanceError
                ? "—"
                : balance != null
                  ? balance.toLocaleString("id-ID")
                  : showLoginNotice
                    ? "—"
                    : "…"}
        </p>
        <p className="font-body-sm text-body-sm text-muted-text">kredit tersisa</p>
        {balanceError ? (
          <p className="mt-2 font-body-sm text-body-sm text-warning">{balanceError}</p>
        ) : null}
      </Card>

      {showMockNotice ? (
        <Card padding="md" className="rounded-2xl border border-border bg-surface-soft">
          <p className="font-body-md text-body-md text-on-surface">
            Top up kredit memerlukan mode API. Setel <code>VITE_USE_MOCKS=false</code>, jalankan{" "}
            <code>dev:api</code>, lalu login ulang.
          </p>
          <p className="mt-2 font-body-sm text-body-sm text-muted-text">
            Mode mock tidak membuat pembayaran palsu dan tidak menambah saldo dari UI.
          </p>
        </Card>
      ) : null}

      {showLoginNotice ? (
        <Card padding="md" className="rounded-2xl border border-warning/30 bg-warning-soft/30">
          <p className="font-body-md text-body-md text-on-surface">
            Silakan login untuk melihat paket dan memulai checkout.
          </p>
        </Card>
      ) : null}

      {showDisabledNotice ? (
        <Card padding="md" className="rounded-2xl border border-border bg-surface-soft">
          <p className="font-body-md text-body-md text-on-surface">Top up belum tersedia.</p>
          <p className="mt-2 font-body-sm text-body-sm text-muted-text">
            Fitur ini diaktifkan bertahap di server. Coba lagi nanti.
          </p>
        </Card>
      ) : null}

      {pageError ? (
        <p className="rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-3 font-body-sm text-body-sm text-on-surface">
          {pageError}
        </p>
      ) : null}

      {checkoutError ? (
        <p className="rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-3 font-body-sm text-body-sm text-on-surface">
          {checkoutError}
        </p>
      ) : null}

      {showReady ? (
        <div className="grid gap-4 md:grid-cols-2">
          {productsLoading ? (
            <p className="font-body-md text-body-md text-muted-text md:col-span-2">
              Memuat paket kredit…
            </p>
          ) : null}
          {!productsLoading && sortedProducts.length === 0 ? (
            <p className="font-body-md text-body-md text-muted-text md:col-span-2">
              Belum ada paket kredit aktif.
            </p>
          ) : null}
          {sortedProducts.map((product) => {
            const slug = product.slug as CreditTopupProductSlug;
            const label = PACKAGE_LABELS[slug] ?? product.name;
            const checkingOut = checkoutSlug === slug;
            return (
              <Card
                key={product.id}
                padding="md"
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-display-sm text-on-surface">{label}</h2>
                  {isRecommended(product) ? (
                    <Badge variant="accent">Rekomendasi</Badge>
                  ) : null}
                </div>
                <p className="font-body-md text-body-md text-on-surface">{formatCreditsLine(product)}</p>
                <p className="font-display text-display-sm text-primary">
                  {formatPriceIdr(product.priceIdr)}
                </p>
                <Button
                  variant="primary"
                  className="mt-auto w-full"
                  disabled={Boolean(checkoutSlug) || productsLoading}
                  onClick={() => void handleCheckout(slug)}
                >
                  {checkingOut ? "Menyiapkan pembayaran…" : "Beli Paket"}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card padding="md" className="rounded-2xl border border-border bg-surface-soft">
        <ul className="list-disc space-y-2 pl-5 font-body-sm text-body-sm text-muted-text">
          <li>Kredit dipakai untuk Tulis Beat, Rewrite, dan Publish Copy AI.</li>
          <li>Pembayaran diproses oleh penyedia pembayaran (Mayar atau Duitku).</li>
          <li>Kredit masuk otomatis setelah notifikasi pembayaran diterima server.</li>
          <li>
            Jika belum masuk, tunggu beberapa saat lalu refresh saldo di halaman ini atau Ruang
            Tulis.
          </li>
        </ul>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link
          to={ROUTES.dashboard}
          className="font-body-sm text-body-sm text-primary underline-offset-2 hover:underline"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}