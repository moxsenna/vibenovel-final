import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Project, UserProfile } from "@vibenovel/shared";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminProject } from "@/services/admin";
import { ROUTES } from "@/routes/paths";
import { Card } from "@/components/ui";

export function AdminProjectDetailPage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminProject(projectId, session?.access_token ?? null);
        if (!cancelled) {
          setProject(data.project);
          setOwner(data.owner);
        }
      } catch {
        if (!cancelled) {
          setProject(null);
          setOwner(null);
          setNotice("Gagal memuat detail proyek.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, session?.access_token]);

  return (
    <div className="flex w-full flex-col gap-lg">
      <header>
        <Link to={ROUTES.admin.projects} className="font-label-sm text-primary hover:underline">
          ← Daftar proyek
        </Link>
        <h1 className="mt-2 font-headline-md text-headline-md text-on-surface">Detail Proyek</h1>
      </header>
      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text">Memuat...</p>
      ) : project ? (
        <Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-label-sm text-muted-text">Judul</dt>
              <dd className="font-body-md">{project.title}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-muted-text">Fase workflow</dt>
              <dd className="font-body-md">{project.workflowPhase}</dd>
            </div>
            <div>
              <dt className="font-label-sm text-muted-text">Pemilik</dt>
              <dd className="font-body-md">
                {owner ? (
                  <Link to={ROUTES.admin.userDetail(owner.id)} className="text-primary hover:underline">
                    {owner.displayName} ({owner.email})
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="font-label-sm text-muted-text">Entry path</dt>
              <dd className="font-body-md">{project.entryPath}</dd>
            </div>
          </dl>
        </Card>
      ) : (
        <Card>
          <p className="text-muted-text">Proyek tidak ditemukan.</p>
        </Card>
      )}
    </div>
  );
}