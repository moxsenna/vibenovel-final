import type { Project, ProjectStatus } from "@vibenovel/shared";
import type { ProjectListOrder, ProjectListSortField } from "@/services/projects";

export interface ProjectBrowseState {
  q: string;
  status: ProjectStatus | "";
  sort: ProjectListSortField;
  order: ProjectListOrder;
}

export const DEFAULT_BROWSE_STATE: ProjectBrowseState = {
  q: "",
  status: "",
  sort: "lastEditedAt",
  order: "desc",
};

export function filterProjectsForBrowse(
  projects: Project[],
  state: ProjectBrowseState,
): Project[] {
  const q = state.q.trim().toLowerCase();
  let list = [...projects];
  if (q) {
    list = list.filter((p) => p.title.toLowerCase().includes(q));
  }
  if (state.status) {
    list = list.filter((p) => p.status === state.status);
  }
  const col = state.sort;
  list.sort((a, b) => {
    let cmp = 0;
    if (col === "title") {
      cmp = a.title.localeCompare(b.title, "id");
    } else if (col === "createdAt") {
      cmp = a.createdAt.localeCompare(b.createdAt);
    } else {
      cmp = a.lastEditedAt.localeCompare(b.lastEditedAt);
    }
    return state.order === "asc" ? cmp : -cmp;
  });
  return list;
}