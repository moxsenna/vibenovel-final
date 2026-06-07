import { Link } from "react-router-dom";
import { Badge, Button, Icon } from "@/components/ui";

export interface OutlinePageHeaderProps {
  planBadge: string;
  title: string;
  description: string;
  startWritingCta: string;
  writeRoute: string;
}

export function OutlinePageHeader({
  planBadge,
  title,
  description,
  startWritingCta,
  writeRoute,
}: OutlinePageHeaderProps) {
  return (
    <header className="flex flex-col items-start justify-between gap-6 border-b border-border pb-6 md:flex-row md:items-end">
      <div>
        <Badge
          variant="neutral"
          icon={<Icon name="auto_awesome" size={16} className="text-primary" />}
          className="mb-3 gap-2 rounded-full border-outline-variant bg-surface-container px-3 py-1"
        >
          {planBadge}
        </Badge>
        <h2 className="font-display text-display text-on-background">{title}</h2>
        <p className="mt-2 max-w-xl font-body-md text-body-md text-subtle-text">{description}</p>
      </div>
      <Link to={writeRoute} className="w-full shrink-0 md:w-auto">
        <Button
          variant="primary"
          pill
          className="w-full justify-center shadow-md md:w-auto"
          leftIcon={<Icon name="edit_document" size={20} filled />}
        >
          {startWritingCta}
        </Button>
      </Link>
    </header>
  );
}