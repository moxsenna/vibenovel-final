import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminProjects, type AdminProjectListItem } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

export function AdminProjectsPage() {
  const { session } = useAuth();
  const [projects, setProjects] = useState<AdminProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminProjects(session?.access_token ?? null);
        if (!cancelled) setProjects(data.projects);
      } catch {
        if (!cancelled) {
          setProjects([]);
          setNotice("Gagal memuat proyek.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Proyek</h1>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat proyek...</p>
      ) : projects.length === 0 ? (
        <Card>
          <p className="font-body-md text-body-md text-muted-text">Belum ada proyek.</p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-border text-muted-text">
                <th className="px-3 py-2">Judul</th>
                <th className="px-3 py-2">Pemilik</th>
                <th className="px-3 py-2">Fase</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      to={ROUTES.admin.projectDetail(p.id)}
                      className="text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{p.ownerDisplayName ?? p.ownerEmail ?? "—"}</td>
                  <td className="px-3 py-3">{p.workflowPhase}</td>
                  <td className="px-3 py-3">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}