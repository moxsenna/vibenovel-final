import { Card, Icon } from "@/components/ui";

export interface SettingsSprintNoteProps {
  title: string;
  body: string;
}

export function SettingsSprintNote({ title, body }: SettingsSprintNoteProps) {
  return (
    <Card
      padding="lg"
      className="rounded-[20px] border-warning/30 bg-warning-soft shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Icon name="info" size={22} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <h3 className="mb-1 font-label-md text-label-md text-on-surface">{title}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>
        </div>
      </div>
    </Card>
  );
}