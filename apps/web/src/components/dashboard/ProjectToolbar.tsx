import type { ProjectStatus } from "@vibenovel/shared";
import { Badge, Icon, Input } from "@/components/ui";
import type { ProjectListOrder, ProjectListSortField } from "@/services/projects";

const STATUS_FILTERS: { value: ProjectStatus | ""; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "Berjalan" },
  { value: "published", label: "Terbit" },
];

const SORT_OPTIONS: { value: ProjectListSortField; label: string }[] = [
  { value: "lastEditedAt", label: "Terakhir diedit" },
  { value: "createdAt", label: "Terbaru dibuat" },
  { value: "title", label: "Judul A–Z" },
];

export interface ProjectToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: ProjectStatus | "";
  onStatusChange: (value: ProjectStatus | "") => void;
  sort: ProjectListSortField;
  onSortChange: (value: ProjectListSortField) => void;
  order: ProjectListOrder;
  onOrderChange: (value: ProjectListOrder) => void;
  total?: number;
}

export function ProjectToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  order,
  onOrderChange,
  total,
}: ProjectToolbarProps) {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-text"
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari judul proyek..."
            className="pl-10"
            aria-label="Cari proyek"
          />
        </div>
        {total !== undefined ? (
          <p className="font-body-sm text-body-sm text-muted-text shrink-0">
            {total} proyek
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-sm">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => onStatusChange(f.value)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft rounded-pill"
          >
            <Badge variant={status === f.value ? "primary" : "neutral"}>
              {f.label}
            </Badge>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-sm">
          <label className="flex items-center gap-2 font-label-sm text-label-sm text-muted-text">
            Urutkan
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as ProjectListSortField)}
              className="min-h-[36px] rounded-md border border-border bg-surface px-2 text-on-surface"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => onOrderChange(order === "desc" ? "asc" : "desc")}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-3 font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-soft"
            aria-label={order === "desc" ? "Urutan menurun" : "Urutan menaik"}
          >
            <Icon name={order === "desc" ? "arrow_downward" : "arrow_upward"} size={18} />
            {order === "desc" ? "Turun" : "Naik"}
          </button>
        </div>
      </div>
    </div>
  );
}