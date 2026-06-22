import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROJECT_ENTRY_PATHS,
  WORKFLOW_PHASES,
  type Project,
  type ProjectStatus,
} from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import {
  DEFAULT_BROWSE_STATE,
  filterProjectsForBrowse,
  type ProjectBrowseState,
} from "@/lib/project-browse";
import { shouldUseMocks } from "@/lib/env";
import { mockProjects } from "@/mocks/projects";
import {
  fetchProjectsPage,
  type ProjectListOrder,
  type ProjectListSortField,
} from "@/services/projects";

const SEARCH_DEBOUNCE_MS = 300;

export interface UseProjectBrowseOptions {
  /** Cap items (dashboard preview). Omit for full paginated browse. */
  previewLimit?: number;
  excludeProjectId?: string | null;
  includeArchived?: boolean;
}

export interface ProjectBrowseResult {
  items: Project[];
  total: number;
  nextCursor: string | null;
  state: ProjectBrowseState;
  setSearch: (q: string) => void;
  setStatusFilter: (status: ProjectStatus | "") => void;
  setSort: (sort: ProjectListSortField) => void;
  setOrder: (order: ProjectListOrder) => void;
  loadMore: () => void;
  refresh: () => void;
  loading: boolean;
  error: string | null;
  isMock: boolean;
}

function toSharedMockProjects(): Project[] {
  return mockProjects.map((p) => ({
    id: p.id,
    ownerId: "mock-owner",
    title: p.title,
    genre: p.genre,
    status: p.status,
    currentChapter: p.currentChapter ?? 0,
    entryPath: PROJECT_ENTRY_PATHS.no_idea,
    isActive: p.id === mockProjects[0]?.id,
    lastEditedAt: p.lastEditedAt,
    workflowPhase: WORKFLOW_PHASES.intake,
    createdAt: p.lastEditedAt,
    updatedAt: p.lastEditedAt,
  }));
}

export function useProjectBrowse(options: UseProjectBrowseOptions = {}): ProjectBrowseResult {
  const { previewLimit, excludeProjectId, includeArchived = true } = options;
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [state, setState] = useState<ProjectBrowseState>(DEFAULT_BROWSE_STATE);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(state.q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state.q]);

  const pageLimit = previewLimit ?? 12;

  const load = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (authLoading) return;
      if (useMocks || !token) {
        let mock = filterProjectsForBrowse(toSharedMockProjects(), {
          ...state,
          q: debouncedQ,
        });
        if (excludeProjectId) {
          mock = mock.filter((p) => p.id !== excludeProjectId);
        }
        const slice = previewLimit ? mock.slice(0, previewLimit) : mock;
        setItems(slice);
        setTotal(mock.length);
        setNextCursor(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const page = await fetchProjectsPage(token, {
          includeArchived,
          q: debouncedQ || undefined,
          status: state.status ? [state.status] : undefined,
          sort: state.sort,
          order: state.order,
          limit: pageLimit,
          cursor,
        });
        // Defensive: a malformed/empty projects page must never crash the
        // dashboard (RecentProjectsSection maps over items).
        let nextItems = page.items ?? [];
        if (excludeProjectId) {
          nextItems = nextItems.filter((p) => p.id !== excludeProjectId);
        }
        setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
        setTotal(page.total ?? nextItems.length);
        setNextCursor(page.nextCursor ?? null);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Gagal memuat daftar proyek.",
        );
        if (!append) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [
      authLoading,
      debouncedQ,
      excludeProjectId,
      includeArchived,
      pageLimit,
      previewLimit,
      state.order,
      state.sort,
      state.status,
      token,
      useMocks,
    ],
  );

  useEffect(() => {
    void load(null, false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!nextCursor || previewLimit) return;
    void load(nextCursor, true);
  }, [load, nextCursor, previewLimit]);

  const refresh = useCallback(() => {
    void load(null, false);
  }, [load]);

  return useMemo(
    () => ({
      items,
      total,
      nextCursor,
      state,
      setSearch: (q: string) => setState((s) => ({ ...s, q })),
      setStatusFilter: (status: ProjectStatus | "") => setState((s) => ({ ...s, status })),
      setSort: (sort: ProjectListSortField) => setState((s) => ({ ...s, sort })),
      setOrder: (order: ProjectListOrder) => setState((s) => ({ ...s, order })),
      loadMore,
      refresh,
      loading,
      error,
      isMock: useMocks || !token,
    }),
    [items, total, nextCursor, state, loadMore, refresh, loading, error, useMocks, token],
  );
}