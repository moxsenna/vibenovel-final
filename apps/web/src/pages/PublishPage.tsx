import {
  PublishActionSection,
  PublishChecklistCard,
  PublishCopyFieldCard,
  PublishMobilePreview,
  PublishPageHeader,
  PublishTagsCard,
} from "@/components/publish";
import { mockPublishPackage } from "@/mocks/publishPackage";

/**
 * Paket Publish — Sprint 1 Task 1.13 (+ 1.17 desktop 2-col polish)
 * Source: stitch-reference/paket_publish_bab_kbm_optimized
 * Content: Bab 1 Makan Malam yang Dingin
 * Wrapped by AppShell via router layout.
 */
export function PublishPage() {
  const pkg = mockPublishPackage;
  const { pageCopy } = pkg;
  const teaserDisplay = `"${pkg.teaser}"`;

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-lg">
      <PublishPageHeader
        badgeLabel={pageCopy.badgeLabel}
        title={pageCopy.title}
        subtitle={pageCopy.subtitle}
      />

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-md lg:col-span-7">
          <PublishCopyFieldCard
            label={pageCopy.titleLabel}
            icon="title"
            value={pkg.title}
          />

          <PublishCopyFieldCard
            label={pageCopy.teaserLabel}
            icon="electric_bolt"
            value={teaserDisplay}
            italic
          />

          <PublishCopyFieldCard
            label={pageCopy.blurbLabel}
            icon="description"
            value={pkg.blurb}
          />

          <PublishCopyFieldCard
            label={pageCopy.captionLabel}
            icon="chat"
            value={pkg.caption}
            preWrap
          />

          <PublishCopyFieldCard
            label={pageCopy.commentBaitLabel}
            icon="forum"
            value={pkg.commentBait}
          />

          <PublishCopyFieldCard
            label={pageCopy.nextChapterLabel}
            icon="fast_forward"
            value={pkg.nextChapterTeaser}
            accentBorder
          />
        </div>

        <div className="flex flex-col gap-md lg:col-span-5">
          <PublishTagsCard label={pageCopy.tagsLabel} tags={pkg.tags} />

          <PublishChecklistCard title={pageCopy.checklistTitle} items={pkg.checklist} />

          <PublishMobilePreview title={pageCopy.mobilePreviewTitle} preview={pkg.mobilePreview} />

          <PublishActionSection
            dashboardCta={pageCopy.dashboardCta}
            summaryCta={pageCopy.summaryCta}
            nextChapterCta={pageCopy.nextChapterCta}
            nextChapterHint={pageCopy.nextChapterHint}
            dashboardRoute={pkg.dashboardRoute}
            summaryRoute={pkg.summaryRoute}
            outlineRoute={pkg.outlineRoute}
            compact
          />
        </div>
      </div>
    </div>
  );
}