import { Card, Icon } from "@/components/ui";

export interface FoundationWarningPanelProps {
  title: string;
  body: string;
  note: string;
}

export function FoundationWarningPanel({ title, body, note }: FoundationWarningPanelProps) {
  return (
    <Card
      padding="sm"
      shadow={false}
      className="flex items-start gap-3 rounded-xl border border-warning bg-warning-soft shadow-sm"
    >
      <Icon name="warning" size={22} className="mt-0.5 text-warning" />
      <div>
        <h4 className="mb-1 font-label-md text-label-md text-on-background">{title}</h4>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>
        <p className="mt-2 font-body-sm text-body-sm font-medium text-on-surface-variant">
          {note}
        </p>
      </div>
    </Card>
  );
}