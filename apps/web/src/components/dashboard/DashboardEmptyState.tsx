import { Link } from "react-router-dom";
import { Button, Card, Icon } from "@/components/ui";
import { ROUTES } from "@/routes/paths";

/** Shown when recent projects list is empty — Sprint 1 lightweight empty state */
export function DashboardEmptyState() {
  return (
    <Card className="mt-xl flex flex-col items-center text-center">
      <div className="mb-md flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="auto_stories" size={24} />
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface">
        Belum ada proyek lain
      </h3>
      <p className="mt-sm max-w-md font-body-md text-body-md text-muted-text">
        Proyek tambahan akan muncul di sini setelah kamu membuat lebih dari satu cerita.
      </p>
      <Link to={ROUTES.start} className="mt-lg">
        <Button variant="primary" leftIcon={<Icon name="add" size={18} />}>
          Buat Proyek Baru
        </Button>
      </Link>
    </Card>
  );
}