import { useState } from "react";
import {
  WriterAssistantPanel,
  WriterBeatList,
  WriterEditorPanel,
  WriterMobileLayout,
} from "@/components/writer";
import { mockChapterDraft } from "@/mocks/chapter";

/**
 * Ruang Tulis — Sprint 1 Task 1.11a (desktop) + 1.11b (mobile)
 * Desktop: stitch-reference/tulis_bab
 * Mobile: stitch-reference/tulis_bab_mobile_polished
 * Wrapped by AppShell via router layout.
 */
export function WritePage() {
  const draft = mockChapterDraft;
  const [activeBeatId, setActiveBeatId] = useState(draft.beats[0]?.id ?? "");

  const activeBeat = draft.beats.find((beat) => beat.id === activeBeatId) ?? draft.beats[0];
  const chapterLabel = `Bab ${draft.chapterNumber}: ${draft.chapterTitle}`;

  if (!activeBeat) {
    return null;
  }

  return (
    <>
      <WriterMobileLayout
        draft={draft}
        activeBeat={activeBeat}
        activeBeatId={activeBeatId}
        onSelectBeat={setActiveBeatId}
      />

      <div className="hidden min-h-0 flex-1 overflow-hidden lg:flex">
        <WriterBeatList
          title={draft.pageCopy.sceneListTitle}
          chapterLabel={chapterLabel}
          beats={draft.beats}
          activeBeatId={activeBeatId}
          onSelectBeat={setActiveBeatId}
        />
        <WriterEditorPanel draft={draft} activeBeat={activeBeat} />
        <WriterAssistantPanel draft={draft} />
      </div>
    </>
  );
}