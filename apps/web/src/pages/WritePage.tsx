import {
  WriterAssistantPanel,
  WriterBeatList,
  WriterEditorPanel,
  WriterMobileLayout,
} from "@/components/writer";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { Button } from "@/components/ui";
import { useWriteRoomData } from "@/hooks/useWriteRoomData";

/**
 * Ruang Tulis — Sprint 1 layout + Sprint 5 API integration (Task 5.5)
 * Mock fallback when VITE_USE_MOCKS=true or API unavailable.
 */
export function WritePage() {
  const {
    draft,
    loading,
    saving,
    buildingContext,
    generatingBeats,
    markingReady,
    notice,
    workflowNotice,
    errorNotice,
    activeBeatId,
    onSelectBeat,
    proseText,
    onProseChange,
    editable,
    needsGenerateBeats,
    generateBeats,
    saveProse,
    buildSafeContext,
    contextPreview,
    finishChapter,
  } = useWriteRoomData();

  const activeBeat = draft.beats.find((beat) => beat.id === activeBeatId) ?? draft.beats[0];
  const chapterLabel = `Bab ${draft.chapterNumber}: ${draft.chapterTitle}`;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-lg">
        <p className="font-body-md text-body-md text-muted-text">Memuat ruang tulis…</p>
      </div>
    );
  }

  if (!activeBeat) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-lg">
        <IntegrationNotice message={notice} />
        <IntegrationNotice message={workflowNotice} />
        {needsGenerateBeats ? (
          <Button variant="primary" disabled={generatingBeats} onClick={() => void generateBeats()}>
            {generatingBeats ? "Membuat adegan…" : "Buat Daftar Adegan"}
          </Button>
        ) : (
          <p className="font-body-md text-body-md text-muted-text">Belum ada adegan untuk ditulis.</p>
        )}
      </div>
    );
  }

  const editorProps = {
    editable,
    proseText,
    onProseChange,
    onSave: editable ? () => void saveProse() : undefined,
    saving,
    onFinish: () => void finishChapter(),
    finishing: markingReady,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-border bg-surface px-md py-2 lg:px-lg">
        <IntegrationNotice message={notice} />
        <IntegrationNotice message={workflowNotice} />
        <IntegrationNotice
          message={errorNotice}
          className={errorNotice ? "border-warning/30 bg-warning-soft text-on-surface" : ""}
        />
        {needsGenerateBeats ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-body-sm text-body-sm text-muted-text">
              Belum ada adegan untuk bab ini.
            </p>
            <Button
              variant="primary"
              size="sm"
              disabled={generatingBeats}
              onClick={() => void generateBeats()}
            >
              {generatingBeats ? "Membuat…" : "Buat Daftar Adegan"}
            </Button>
          </div>
        ) : null}
      </div>

      <WriterMobileLayout
        draft={draft}
        activeBeat={activeBeat}
        activeBeatId={activeBeatId}
        onSelectBeat={(id) => void onSelectBeat(id)}
        {...editorProps}
      />

      <div className="hidden min-h-0 flex-1 overflow-hidden lg:flex">
        <WriterBeatList
          title={draft.pageCopy.sceneListTitle}
          chapterLabel={chapterLabel}
          beats={draft.beats}
          activeBeatId={activeBeatId}
          onSelectBeat={(id) => void onSelectBeat(id)}
        />
        <WriterEditorPanel draft={draft} activeBeat={activeBeat} {...editorProps} />
        <WriterAssistantPanel
          draft={draft}
          contextPreview={contextPreview}
          onBuildContext={editable ? () => void buildSafeContext() : undefined}
          buildingContext={buildingContext}
        />
      </div>
    </div>
  );
}