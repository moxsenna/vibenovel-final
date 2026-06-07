import { EntryOptionCard, StartProjectHeader } from "@/components/start-project";
import { mockStartProjectOptions } from "@/mocks/startProject";

/**
 * Mulai Proyek Baru — Sprint 1 Task 1.5
 * Source: stitch-reference/mulai_proyek_baru_polished
 * Wrapped by AppShell via router layout.
 */
export function StartProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-xl py-md">
      <StartProjectHeader />

      <div className="grid w-full grid-cols-1 gap-md md:grid-cols-2 md:gap-lg">
        {mockStartProjectOptions.map((option) => (
          <EntryOptionCard key={option.id} option={option} />
        ))}
      </div>
    </div>
  );
}