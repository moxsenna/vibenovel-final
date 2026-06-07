import {
  FoundationCharacterList,
  FoundationLockCta,
  FoundationPageHeader,
  FoundationReadinessCard,
  FoundationSectionCard,
  FoundationWarningPanel,
} from "@/components/foundation";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { Badge, Card, Icon } from "@/components/ui";
import { useFoundationData } from "@/hooks/useFoundationData";

/**
 * Fondasi Cerita — Sprint 1 Task 1.9 (+ Sprint 2 Task 2.13 API integration)
 * Source: stitch-reference/fondasi_cerita_refined
 * Wrapped by AppShell via router layout.
 */
export function FoundationPage() {
  const { foundation, notice, loading } = useFoundationData();
  const { pageCopy } = foundation;

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-8">
      <FoundationPageHeader title={pageCopy.title} subtitle={pageCopy.subtitle} />

      <IntegrationNotice message={notice} />
      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat fondasi cerita...
        </p>
      ) : null}

      <FoundationReadinessCard readiness={foundation.readiness} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FoundationSectionCard title="Tentang Cerita" icon="import_contacts">
          <p className="line-clamp-4 font-body-md text-body-md text-on-surface-variant">
            {foundation.premise}
          </p>
        </FoundationSectionCard>

        <FoundationSectionCard title="Tokoh Utama" icon="person">
          <FoundationCharacterList characters={foundation.mainCharacters} />
        </FoundationSectionCard>

        <FoundationSectionCard title="Tokoh Penting" icon="groups">
          <FoundationCharacterList characters={foundation.supportingCharacters} />
        </FoundationSectionCard>

        <FoundationSectionCard title="Konflik Utama" icon="swords">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {foundation.mainConflict}
          </p>
        </FoundationSectionCard>

        <FoundationSectionCard title="Janji ke Pembaca" icon="volunteer_activism">
          <ul className="list-inside list-disc space-y-1 font-body-md text-body-md text-on-surface-variant">
            {foundation.readerPromiseItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </FoundationSectionCard>

        <FoundationSectionCard
          title="Rahasia Cerita"
          icon="key"
          className="md:col-span-2"
        >
          <Card
            padding="sm"
            shadow={false}
            className="flex items-start gap-3 rounded-xl border-border bg-surface-soft"
          >
            <Icon name="lock" size={22} className="mt-0.5 text-muted-text" />
            <p className="font-body-md text-body-md italic text-on-surface-variant">
              {foundation.storySecretsPreview}
            </p>
          </Card>
        </FoundationSectionCard>

        <FoundationSectionCard
          title="Gaya Cerita"
          icon="palette"
          className="md:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            {foundation.storyStyleTags.map((tag) => (
              <Badge
                key={tag}
                variant="neutral"
                className="rounded-full border-0 bg-surface-variant px-3 py-1 text-on-surface-variant"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </FoundationSectionCard>

        <FoundationSectionCard title="Fakta yang Dikunci" icon="push_pin">
          <ul className="list-inside list-disc space-y-1 font-body-md text-body-md text-on-surface-variant">
            {foundation.lockedFacts.map((fact) => (
              <li key={fact.id}>{fact.value}</li>
            ))}
          </ul>
        </FoundationSectionCard>

        <FoundationSectionCard title="Jadwal Rahasia" icon="schedule">
          <ul className="space-y-2 font-body-md text-body-md text-on-surface-variant">
            {foundation.secretSchedule.map((item) => (
              <li key={item.id}>
                <span className="font-medium text-primary">{item.chapterLabel}:</span>{" "}
                {item.description}
              </li>
            ))}
          </ul>
        </FoundationSectionCard>
      </div>

      <div className="mt-4 flex flex-col gap-6">
        <FoundationWarningPanel
          title={pageCopy.warningTitle}
          body={pageCopy.warningBody}
          note={pageCopy.warningNote}
        />
        <FoundationLockCta
          label={pageCopy.lockCtaLabel}
          outlineRoute={foundation.outlineRoute}
        />
      </div>
    </div>
  );
}