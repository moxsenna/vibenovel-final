import { ConceptCard, ConceptsPageHeader } from "@/components/concepts";
import { CONCEPTS_PAGE_COPY, mockConcepts } from "@/mocks/concepts";

/**
 * Pilihan Konsep Cerita — Sprint 1 Task 1.8
 * Source: stitch-reference/pilihan_konsep_cerita_refined
 * Wrapped by AppShell via router layout.
 */
export function ConceptsPage() {
  return (
    <div className="mx-auto flex w-full max-w-dashboard flex-1 flex-col">
      <ConceptsPageHeader
        title={CONCEPTS_PAGE_COPY.title}
        subtitle={CONCEPTS_PAGE_COPY.subtitle}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        {mockConcepts.map((concept) => (
          <ConceptCard key={concept.id} concept={concept} />
        ))}
      </div>
    </div>
  );
}