import { Badge, Card, CopyButton, Icon } from "@/components/ui";

export interface PublishTagsCardProps {
  label: string;
  tags: string[];
}

export function PublishTagsCard({ label, tags }: PublishTagsCardProps) {
  const copyValue = tags.join(", ");

  return (
    <Card
      padding="sm"
      className="flex flex-col gap-sm rounded-xl border-border p-4 shadow-sm md:p-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
          <Icon name="tag" size={18} />
          {label}
        </h3>
        <CopyButton value={copyValue} label="Salin semua tag" />
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="neutral"
            className="rounded-full border-0 bg-surface-container px-3 py-1 text-on-surface"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </Card>
  );
}