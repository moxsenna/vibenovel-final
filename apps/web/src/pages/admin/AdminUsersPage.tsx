import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { UserProfile } from "@vibenovel/shared";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminUsers } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

export function AdminUsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotice(null);
      try {
        const data = await fetchAdminUsers(session?.access_token ?? null);
        if (!cancelled) setUsers(data.users);
      } catch {
        if (!cancelled) {
          setUsers([]);
          setNotice("Gagal memuat daftar pengguna dari API admin.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Pengguna</h1>
        <p className="mt-1 font-body-md text-body-md text-muted-text">Profil dari tabel `profiles`.</p>
      </header>

      <IntegrationNotice message={notice} />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat pengguna...
        </p>
      ) : users.length === 0 ? (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">Belum ada pengguna.</p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-border text-muted-text">
                <th className="px-3 py-2 font-label-sm">Nama</th>
                <th className="px-3 py-2 font-label-sm">Email</th>
                <th className="px-3 py-2 font-label-sm">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      to={ROUTES.admin.userDetail(user.id)}
                      className="font-label-md text-primary hover:underline"
                    >
                      {user.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-on-surface-variant">{user.email}</td>
                  <td className="px-3 py-3 text-on-surface-variant">{user.role ?? "writer"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}