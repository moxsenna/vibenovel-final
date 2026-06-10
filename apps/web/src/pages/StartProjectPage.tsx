import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EntryOptionCard, StartProjectHeader } from "@/components/start-project";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useAuth } from "@/context/AuthContext";
import {
  resolveDemoStartProjectRoute,
  resolveStartProjectRoute,
  START_PROJECT_OPTIONS,
  type StartProjectOptionDef,
} from "@/config/startProjectOptions";
import { ApiClientError } from "@/lib/api";
import { shouldUseMocks } from "@/lib/env";
import { ROUTES } from "@/routes/paths";
import { createProject } from "@/services/projects";

/**
 * Mulai Proyek Baru — Sprint 1 Task 1.5 (+ Task 10.26 real project creation)
 * Source: stitch-reference/mulai_proyek_baru_polished
 * Wrapped by AppShell via router layout.
 */
export function StartProjectPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (option: StartProjectOptionDef) => {
      setError(null);

      if (useMocks) {
        navigate(resolveDemoStartProjectRoute(option.target));
        return;
      }

      if (!token) {
        navigate(ROUTES.login);
        return;
      }

      setCreatingId(option.id);
      try {
        const project = await createProject(
          { title: option.defaultTitle, entryPath: option.entryPath },
          token,
        );
        navigate(resolveStartProjectRoute(project.id, option.target));
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? `Gagal membuat proyek (${err.message}).`
            : "Gagal membuat proyek. Coba lagi.",
        );
      } finally {
        setCreatingId(null);
      }
    },
    [navigate, token, useMocks],
  );

  const notice =
    useMocks
      ? "Mode demo — kartu ini membuka alur contoh dengan data mock."
      : !authLoading && !token
        ? "Masuk ke akun untuk membuat proyek nyata di database."
        : null;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-xl py-md">
      <StartProjectHeader />
      <IntegrationNotice message={notice} />
      <IntegrationNotice message={error} className="border-error/30 bg-error-soft text-error" />

      <div className="grid w-full grid-cols-1 gap-md md:grid-cols-2 md:gap-lg">
        {START_PROJECT_OPTIONS.map((option) => (
          <EntryOptionCard
            key={option.id}
            option={option}
            onSelect={() => void handleSelect(option)}
            loading={creatingId === option.id}
            disabled={Boolean(creatingId) || authLoading}
            demoMode={useMocks}
          />
        ))}
      </div>
    </div>
  );
}