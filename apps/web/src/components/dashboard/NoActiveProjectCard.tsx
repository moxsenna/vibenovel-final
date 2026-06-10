import { Link } from "react-router-dom";
import { Button, Icon } from "@/components/ui";
import { ROUTES } from "@/routes/paths";

/** Shown when authenticated user has no projects yet — private beta empty state */
export function NoActiveProjectCard() {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-dashed border-border bg-surface p-lg shadow-sm lg:col-span-2">
      <div className="relative z-10 flex flex-1 flex-col items-start gap-md">
        <span className="rounded-full bg-primary-soft px-3 py-1 font-label-sm text-label-sm text-primary">
          Private beta
        </span>
        <h3 className="font-headline-lg text-headline-lg text-on-surface">
          Belum ada proyek
        </h3>
        <p className="max-w-lg font-body-md text-body-md text-muted-text">
          Buat proyek pertama untuk menyimpan ide cerita ke database. Setelah itu kamu bisa
          mulai intake dan melanjutkan alur cerita dengan data nyata.
        </p>
        <Link to={ROUTES.start}>
          <Button variant="primary" leftIcon={<Icon name="add" size={18} />}>
            Buat Proyek Pertama
          </Button>
        </Link>
      </div>
    </div>
  );
}