import type { ChapterDraft } from "@/types";
import { Button, Card, Icon } from "@/components/ui";

export interface WriterAssistantPanelProps {
  draft: ChapterDraft;
}

export function WriterAssistantPanel({ draft }: WriterAssistantPanelProps) {
  const { pageCopy, storyChecks } = draft;

  return (
    <aside className="z-10 hidden h-full w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface shadow-[-4px_0_24px_rgba(31,41,51,0.02)] xl:flex">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface p-lg">
        <h2 className="flex items-center gap-2 font-headline-md text-headline-md text-on-surface">
          <Icon name="auto_awesome" size={22} className="text-primary" />
          {pageCopy.assistantTitle}
        </h2>
        <button
          type="button"
          aria-label="Tutup panel asisten"
          className="rounded-full p-1 text-muted-text transition-colors hover:text-on-surface"
          disabled
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-6 p-lg">
        <div className="flex flex-col gap-3">
          <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
            Bantu Menulis
          </h3>
          <Button
            variant="primary"
            className="w-full rounded-xl py-3.5 shadow-md shadow-primary/20"
            leftIcon={<Icon name="edit_document" size={20} />}
            disabled
          >
            {pageCopy.writeSceneAction}
          </Button>
        </div>

        <div className="h-px w-full bg-border/50" />

        <div className="flex flex-col gap-3">
          <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
            Perbaiki Teks
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-xl border border-border p-3 text-left hover:border-primary-soft hover:bg-primary-soft/30"
              disabled
              leftIcon={
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Icon name="favorite" size={18} />
                </span>
              }
            >
              <span className="font-body-sm text-body-sm">{pageCopy.strengthenEmotionAction}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-xl border border-border p-3 text-left hover:border-primary-soft hover:bg-primary-soft/30"
              disabled
              leftIcon={
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Icon name="forum" size={18} />
                </span>
              }
            >
              <span className="font-body-sm text-body-sm">{pageCopy.addDialogAction}</span>
            </Button>
          </div>
        </div>

        <div className="h-px w-full bg-border/50" />

        <div className="flex flex-col gap-3">
          <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
            {pageCopy.storyCheckTitle}
          </h3>
          <div className="flex flex-col gap-2">
            {storyChecks.map((check) =>
              check.status === "ok" ? (
                <Card
                  key={check.id}
                  padding="sm"
                  shadow={false}
                  className="flex items-center justify-between rounded-xl border border-success-soft bg-success-soft/50"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="check_circle" size={20} className="text-tertiary" />
                    <span className="font-body-sm text-body-sm text-on-surface">{check.label}</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-tertiary">
                    {check.statusLabel}
                  </span>
                </Card>
              ) : (
                <Card
                  key={check.id}
                  padding="sm"
                  shadow={false}
                  className="flex flex-col gap-2 rounded-xl border border-warning/20 bg-warning-soft"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon name="warning" size={20} className="text-warning" />
                      <span className="font-body-sm text-body-sm text-on-surface">
                        {check.label}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm font-bold text-warning">
                      {check.statusLabel}
                    </span>
                  </div>
                  {check.detail && (
                    <p className="pl-8 font-body-sm text-body-sm text-on-surface-variant">
                      {check.detail}
                    </p>
                  )}
                </Card>
              ),
            )}
          </div>
          <Button
            variant="ghost"
            className="mt-2 w-full rounded-xl border border-border text-primary hover:border-primary hover:bg-primary-soft"
            leftIcon={<Icon name="checklist" size={18} />}
            disabled
          >
            {pageCopy.recheckLabel}
          </Button>
        </div>
      </div>
    </aside>
  );
}