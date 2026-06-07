import { Link } from "react-router-dom";
import { Badge, Icon } from "@/components/ui";
import { ROUTES } from "@/routes/paths";

const ENTRY_CHIPS = ["Dari nol", "Ada ide kasar", "Sudah ada outline"] as const;

export function NewProjectCta() {
  return (
    <Link
      to={ROUTES.start}
      className="group flex h-full min-h-[168px] w-full flex-col justify-between gap-md rounded-[20px] border border-dashed border-border bg-surface p-lg text-on-surface-variant shadow-sm transition-all hover:border-primary hover:bg-surface-bright hover:text-primary"
    >
      <div className="flex flex-col gap-md">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-variant transition-colors group-hover:bg-primary-soft">
          <Icon name="add" size={22} />
        </div>
        <div>
          <span className="font-headline-md text-headline-md text-on-surface group-hover:text-primary">
            Buat Proyek Baru
          </span>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text group-hover:text-on-surface-variant">
            Mulai dari obrolan ide, kembangkan konsep, atau langsung ke outline.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTRY_CHIPS.map((chip) => (
          <Badge
            key={chip}
            variant="neutral"
            className="border-0 bg-surface-container text-on-surface-variant"
          >
            {chip}
          </Badge>
        ))}
      </div>
    </Link>
  );
}