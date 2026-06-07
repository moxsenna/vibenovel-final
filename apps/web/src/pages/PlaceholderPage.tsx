import { Link } from "react-router-dom";
import { Badge, Button, Card, CopyButton } from "@/components/ui";
import { DEMO_PROJECT_ID } from "@/mocks";
import { PLACEHOLDER_ROUTES } from "@/routes/paths";

export interface PlaceholderPageProps {
  title: string;
  stitchSource: string;
  routePath: string;
}

/**
 * Sprint 1 Task 1.2 — route placeholder only.
 * Final page UI comes in Tasks 1.4–1.15.
 */
export function PlaceholderPage({ title, stitchSource, routePath }: PlaceholderPageProps) {
  const demoPath = routePath.replace(":id", DEMO_PROJECT_ID);

  return (
    <div className="mx-auto max-w-form w-full">
        <Badge variant="primary">Sprint 1 — Placeholder</Badge>
        <h1 className="mt-md text-display font-display text-on-background">{title}</h1>
        <p className="mt-sm text-body-md text-muted-text">
          Route: <code className="text-on-surface">{demoPath}</code>
        </p>
        <p className="mt-xs text-body-sm text-subtle-text">
          Stitch source: <code className="text-on-surface">{stitchSource}</code>
        </p>

        <Card className="mt-lg">
          <p className="text-body-md text-on-surface-variant">
            Halaman final belum dibangun. Komponen dasar dan mock data sudah tersedia untuk Task berikutnya.
          </p>
          <div className="mt-md flex flex-wrap gap-sm">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <CopyButton value="Teks contoh paket publish — dummy copy" />
          </div>
          <div className="mt-md flex flex-wrap gap-sm">
            <Badge variant="accent">Rahasia</Badge>
            <Badge variant="success">Kemenangan Kecil</Badge>
            <Badge variant="warning">Perlu Dicek</Badge>
          </div>
        </Card>

        <Card className="mt-md" padding="sm">
          <h2 className="text-label-md font-label-md text-on-surface mb-sm">Navigasi Skeleton</h2>
          <ul className="flex flex-col gap-xs">
            {PLACEHOLDER_ROUTES.map((route) => {
              const href =
                route.path.includes(":id")
                  ? route.path.replace(":id", DEMO_PROJECT_ID)
                  : route.path;
              return (
                <li key={route.path}>
                  <Link
                    to={href}
                    className="text-body-sm text-primary hover:text-primary-dark hover:underline"
                  >
                    {route.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
    </div>
  );
}