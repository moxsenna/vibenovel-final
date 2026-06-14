import { Link } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useDraftImportData } from "@/hooks/useDraftImportData";
import { ROUTES } from "@/routes/paths";
import type { DraftImportSignal } from "@/services/draftImport";

const SIGNAL_LABELS: Record<string, string> = {
  genre: "Genre",
  protagonist: "Tokoh",
  core_conflict: "Konflik",
  reader_promise: "Janji Pembaca",
  target_reader: "Target Pembaca",
  continuity_warning: "Catatan Kontinuitas",
};

function SignalPanel({ signal }: { signal: DraftImportSignal }) {
  return (
    <article className="rounded-lg border border-border bg-surface-container-low p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-label-md text-label-md text-muted-text">
          {SIGNAL_LABELS[signal.type] ?? signal.type}
        </p>
        {signal.confidence !== null ? (
          <span className="rounded-full bg-primary-soft px-2 py-1 font-label-sm text-label-sm text-primary">
            {Math.round(signal.confidence * 100)}%
          </span>
        ) : null}
      </div>
      <h3 className="font-title-sm text-title-sm text-main-text">{signal.label}</h3>
      <p className="mt-2 font-body-sm text-body-sm text-muted-text">{signal.value}</p>
    </article>
  );
}

export function DraftImportPage() {
  const {
    projectId,
    draftImport,
    signals,
    content,
    loading,
    importing,
    extracting,
    notice,
    apiMode,
    setContent,
    importDraft,
    extractSignals,
  } = useDraftImportData();

  const canImport = apiMode && content.trim().length >= 120 && !importing;
  const canExtract = apiMode && Boolean(draftImport) && !extracting;
  const conceptsRoute = projectId ? ROUTES.project.concepts(projectId) : ROUTES.dashboard;

  return (
    <div className="mx-auto flex w-full max-w-editor flex-col gap-lg pb-24">
      <header className="flex flex-col gap-2">
        <p className="font-label-md text-label-md text-primary">Draft Import</p>
        <h1 className="font-display-sm text-display-sm text-main-text">
          Lanjutkan dari naskah yang sudah ada
        </h1>
        <p className="max-w-[720px] font-body-md text-body-md text-muted-text">
          Tempel draft lama untuk dibaca sebagai sinyal cerita. Hasil deteksi menjadi
          bahan proposal, bukan perubahan canon otomatis.
        </p>
      </header>

      <IntegrationNotice message={notice} />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat proyek...
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-lg lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="flex flex-col gap-md">
          <label className="font-title-sm text-title-sm text-main-text" htmlFor="draft-import-content">
            Isi draft
          </label>
          <textarea
            id="draft-import-content"
            className="min-h-[360px] resize-y rounded-lg border border-border bg-surface px-4 py-3 font-body-md text-body-md text-main-text outline-none focus:border-primary"
            placeholder="Tempel 1-3 bab awal atau potongan naskah yang ingin dianalisis..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-sm">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void importDraft()}
              disabled={!canImport}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              {importing ? "Mengimpor..." : "Import draft"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-label-md text-label-md text-main-text disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void extractSignals()}
              disabled={!canExtract}
            >
              <span className="material-symbols-outlined text-[18px]">travel_explore</span>
              {extracting ? "Mendeteksi..." : "Deteksi sinyal"}
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface-container-low p-4">
            <p className="font-label-md text-label-md text-muted-text">Status Import</p>
            {draftImport ? (
              <div className="mt-3 flex flex-col gap-2 font-body-sm text-body-sm text-muted-text">
                <p>
                  <span className="text-main-text">{draftImport.wordCount}</span> kata terdeteksi.
                </p>
                <p>Status: {draftImport.status}</p>
                <p className="line-clamp-4">{draftImport.excerptPreview}</p>
              </div>
            ) : (
              <p className="mt-3 font-body-sm text-body-sm text-muted-text">
                Belum ada draft yang diimpor.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-title-md text-title-md text-main-text">Panel Deteksi</h2>
              <span className="font-label-sm text-label-sm text-muted-text">
                {signals.length} sinyal
              </span>
            </div>
            {signals.length > 0 ? (
              signals.map((signal) => <SignalPanel key={signal.id} signal={signal} />)
            ) : (
              <p className="rounded-lg border border-border bg-surface-container-low p-4 font-body-sm text-body-sm text-muted-text">
                Deteksi belum dijalankan. Panel akan menampilkan genre, tokoh, konflik,
                target pembaca, dan catatan kontinuitas.
              </p>
            )}
          </div>

          <Link
            to={conceptsRoute}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-label-md text-label-md ${
              signals.length > 0
                ? "bg-secondary text-on-secondary"
                : "pointer-events-none bg-surface-container text-muted-text"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            Ubah sinyal jadi proposal konsep
          </Link>
        </aside>
      </section>
    </div>
  );
}
