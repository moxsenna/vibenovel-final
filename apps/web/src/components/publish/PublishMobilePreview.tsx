import type { PublishMobilePreview as PublishMobilePreviewData } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface PublishMobilePreviewProps {
  title: string;
  preview: PublishMobilePreviewData;
}

export function PublishMobilePreview({ title, preview }: PublishMobilePreviewProps) {
  return (
    <Card padding="sm" className="rounded-xl border-border p-4 shadow-sm md:p-lg">
      <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md text-on-background">
        <Icon name="smartphone" size={22} className="text-primary" />
        {title}
      </h3>
      <div className="mx-auto max-w-[280px] rounded-[24px] border-4 border-inverse-surface bg-inverse-surface p-2 shadow-lg">
        <div className="overflow-hidden rounded-[18px] bg-surface">
          <div className="border-b border-border bg-surface-container-low px-3 py-2">
            <p className="text-center font-label-sm text-label-sm text-muted-text">
              {preview.appName}
            </p>
          </div>
          <div className="space-y-3 p-4">
            <p className="font-label-md text-label-md text-primary">{preview.chapterLabel}</p>
            <p className="font-body-sm text-body-sm leading-relaxed text-on-surface">
              {preview.excerpt}
            </p>
            <p className="font-label-sm text-label-sm text-primary">{preview.readMoreLabel}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}