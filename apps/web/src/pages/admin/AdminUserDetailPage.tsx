import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreditBalance, CreditLedgerEntry, UserProfile } from "@vibenovel/shared";
import { GrantCreditsModal } from "@/components/admin/GrantCreditsModal";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminUser, fetchAdminUserCredits } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Button, Card } from "@/components/ui";

export function AdminUserDetailPage() {
  const { userId = "" } = useParams();
  const { session } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotice(null);
      try {
        const [profile, credit] = await Promise.all([
          fetchAdminUser(userId, session?.access_token ?? null),
          fetchAdminUserCredits(userId, session?.access_token ?? null),
        ]);
        if (!cancelled) {
          setUser(profile.user);
          setBalance(credit.credit.balance);
          setLedger(credit.credit.recentLedger);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setBalance(null);
          setLedger([]);
          setNotice("Gagal memuat detail pengguna.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, userId]);

  return (
    <div className="flex w-full flex-col gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <Link to={ROUTES.admin.users} className="font-label-sm text-primary hover:underline">
            ← Kembali ke daftar
          </Link>
          <h1 className="mt-2 font-headline-md text-headline-md text-on-surface">Detail Pengguna</h1>
        </div>
        {user ? (
          <Button type="button" onClick={() => setGrantOpen(true)}>
            Grant Kredit
          </Button>
        ) : null}
      </header>

      <IntegrationNotice message={notice} />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat profil...
        </p>
      ) : user ? (
        <>
          <Card>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-label-sm text-label-sm text-muted-text">Nama</dt>
                <dd className="font-body-md text-body-md">{user.displayName}</dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-muted-text">Email</dt>
                <dd className="font-body-md text-body-md">{user.email}</dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-muted-text">Role</dt>
                <dd className="font-body-md text-body-md">{user.role ?? "writer"}</dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-muted-text">Plan</dt>
                <dd className="font-body-md text-body-md">{user.planLabel}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2 className="font-headline-sm text-headline-sm">Kredit</h2>
            <p className="mt-2 font-body-md">Saldo: {balance ? balance.balance : "—"}</p>
            {ledger.length > 0 ? (
              <ul className="mt-md max-h-48 overflow-y-auto font-body-sm text-muted-text">
                {ledger.map((entry) => (
                  <li key={entry.id}>
                    {entry.createdAt} · {entry.direction} {entry.amount} · {entry.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-body-sm text-muted-text">Belum ada entri ledger.</p>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">Pengguna tidak ditemukan.</p>
        </Card>
      )}

      {user ? (
        <GrantCreditsModal
          userId={user.id}
          userLabel={user.displayName}
          open={grantOpen}
          onClose={() => setGrantOpen(false)}
        />
      ) : null}
    </div>
  );
}