import { Card } from "@/components/ui";

export interface AdminEmptyStateProps {
  title: string;
  description: string;
}

export function AdminEmptyState({ title, description }: AdminEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center text-center">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      <p className="mt-2 max-w-md font-body-md text-body-md text-muted-text">{description}</p>
    </Card>
  );
}