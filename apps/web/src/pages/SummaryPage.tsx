import {
  SummaryActionFooter,
  SummaryBulletList,
  SummaryCharacterChanges,
  SummaryMiniVictoryBanner,
  SummaryOpenLoopsSection,
  SummaryPageHeader,
  SummarySectionCard,
  SummaryStoryCheckNotes,
  SummarySynopsisCard,
} from "@/components/summary";
import { mockChapterSummary } from "@/mocks/summary";

/**
 * Ringkasan Bab — Sprint 1 Task 1.12
 * Source: stitch-reference/ringkasan_bab_drama_consistent
 * Content: Bab 1 Makan Malam yang Dingin
 * Wrapped by AppShell via router layout.
 */
export function SummaryPage() {
  const summary = mockChapterSummary;
  const { pageCopy } = summary;
  const chapterLabel = `Bab ${summary.chapterNumber}: ${summary.chapterTitle}`;
  const statusLabel =
    summary.status === "ready_for_review" ? pageCopy.statusReady : pageCopy.statusDraft;

  return (
    <>
      <div className="mx-auto flex w-full max-w-editor flex-col gap-lg pb-32">
        <SummaryPageHeader
          badgeLabel={pageCopy.badgeLabel}
          title={pageCopy.title}
          subtitle={pageCopy.subtitle}
          chapterLabel={chapterLabel}
          statusLabel={statusLabel}
        />

        <SummarySynopsisCard synopsis={summary.synopsis} />

        <SummaryMiniVictoryBanner items={summary.miniVictories} />

        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <SummarySectionCard title="Fakta Baru" icon="menu_book">
            <SummaryBulletList items={summary.newFacts} />
          </SummarySectionCard>

          <SummarySectionCard
            title="Perubahan Tokoh"
            icon="psychology"
            iconClassName="text-secondary"
          >
            <SummaryCharacterChanges changes={summary.characterChanges} />
          </SummarySectionCard>

          <SummarySectionCard title="Perubahan Relasi" icon="groups" iconClassName="text-primary">
            <SummaryBulletList items={summary.relationChanges} icon="swap_horiz" />
          </SummarySectionCard>

          <SummarySectionCard
            title="Rahasia yang Masih Ditahan"
            icon="lock"
            iconFilled
            iconClassName="text-primary"
          >
            <SummaryBulletList items={summary.heldSecrets} icon="visibility_off" />
          </SummarySectionCard>

          <SummarySectionCard
            title="Yang Masih Menggantung"
            icon="all_inclusive"
            iconClassName="text-warning"
            className="md:col-span-2"
          >
            <SummaryOpenLoopsSection openLoops={summary.openLoops} />
          </SummarySectionCard>

          <SummarySectionCard
            title="Catatan Cek Cerita"
            icon="checklist"
            iconClassName="text-primary"
            className="md:col-span-2"
          >
            <SummaryStoryCheckNotes notes={summary.storyCheckNotes} />
          </SummarySectionCard>
        </div>
      </div>

      <SummaryActionFooter
        approveCta={pageCopy.approveCta}
        backToWriteCta={pageCopy.backToWriteCta}
        publishRoute={summary.publishRoute}
        writeRoute={summary.writeRoute}
      />
    </>
  );
}