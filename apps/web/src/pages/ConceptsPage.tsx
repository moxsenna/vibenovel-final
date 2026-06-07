import { ConceptCard, ConceptsPageHeader } from "@/components/concepts";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { Button } from "@/components/ui";
import { useConceptsData } from "@/hooks/useConceptsData";

/**
 * Pilihan Konsep Cerita — Sprint 1 Task 1.8 (+ Sprint 3 Task 3.6 API integration)
 * Source: stitch-reference/pilihan_konsep_cerita_refined
 * Wrapped by AppShell via router layout.
 */
export function ConceptsPage() {
  const {
    concepts,
    pageCopy,
    notice,
    loading,
    generating,
    selectingId,
    apiMode,
    generate,
    selectConceptById,
  } = useConceptsData();

  return (
    <div className="mx-auto flex w-full max-w-dashboard flex-1 flex-col">
      <ConceptsPageHeader title={pageCopy.title} subtitle={pageCopy.subtitle} />

      <IntegrationNotice message={notice} className="mb-4" />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat konsep cerita...
        </p>
      ) : null}

      {apiMode && concepts.length === 0 && !loading && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border border-border bg-surface-soft p-6">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Belum ada konsep untuk proyek ini. Buat 3 arah cerita dari obrolan intake.
          </p>
          <Button
            variant="primary"
            className="rounded-xl"
            disabled={generating}
            onClick={() => void generate()}
          >
            {generating ? "Membuat konsep..." : "Buat 3 Konsep Cerita"}
          </Button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        {concepts.map((concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
            onSelect={apiMode ? selectConceptById : undefined}
            selecting={selectingId === concept.id}
          />
        ))}
      </div>
    </div>
  );
}