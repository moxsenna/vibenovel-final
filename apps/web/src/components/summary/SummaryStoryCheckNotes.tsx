import type { StoryCheckNote } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface SummaryStoryCheckNotesProps {
  notes: StoryCheckNote[];
}

export function SummaryStoryCheckNotes({ notes }: SummaryStoryCheckNotesProps) {
  return (
    <div className="flex flex-col gap-3">
      {notes.map((note) =>
        note.status === "ok" ? (
          <Card
            key={note.id}
            padding="sm"
            shadow={false}
            className="flex items-start gap-3 rounded-xl border border-success-soft bg-success-soft/50"
          >
            <Icon name="check_circle" size={20} className="mt-0.5 shrink-0 text-tertiary" />
            <div>
              <p className="font-body-sm text-body-sm font-medium text-on-surface">{note.label}</p>
              {note.detail && (
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {note.detail}
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Card
            key={note.id}
            padding="sm"
            shadow={false}
            className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft"
          >
            <Icon name="warning" size={20} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-body-sm text-body-sm font-medium text-on-surface">{note.label}</p>
              {note.detail && (
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {note.detail}
                </p>
              )}
            </div>
          </Card>
        ),
      )}
    </div>
  );
}