import { GENERATION_TYPES } from "@vibenovel/shared";
import { AppError } from "../errors.js";
import type {
  MockAiProviderMode,
  ModelRouterGenerateInput,
  ModelRouterGenerateResult,
  ResolvedModelConfig,
} from "./ai-generation-types.js";

const MOCK_PROSE_BEAT_TEMPLATE =
  "Dia menahan napas. Ruangan itu terasa lebih sempit dari biasanya, " +
  "seolah setiap kata yang belum terucap ikut menekan dadanya. " +
  "Langkahnya pelan menuju jendela — bukan untuk kabur, melainkan " +
  "untuk memastikan dunia di luar masih ada sebelum ia mengambil keputusan.";


function buildMockBeatGenerationJson(input: ModelRouterGenerateInput): string {
  const h = input.promptHash.slice(0, 6);
  return JSON.stringify({
    beats: [
      { beatNumber: 1, title: "Pembukaan", summary: "Adegan pembuka memperkenalkan konflik langsung.", direction: "Mulai dari ketegangan kecil lalu eskalasi.", emotionalShift: "ragu → waspada", mustInclude: ["POV jelas"], mustNotInclude: ["spoiler bab depan"], wordTarget: 400, stopCondition: "Konflik utama tersentuh." },
      { beatNumber: 2, title: "Gesekan", summary: "Karakter menghadapi hambatan pertama.", direction: "Percepat ritme dialog.", emotionalShift: "waspada → tegang", mustInclude: ["reaksi fisik"], mustNotInclude: [], wordTarget: 450, stopCondition: "Stakes naik." },
      { beatNumber: 3, title: "Keputusan", summary: "Pilihan sulit memaksa perubahan rencana.", direction: "Tutup dengan hook emosional.", emotionalShift: "tegang → resolute", mustInclude: ["hook penutup"], mustNotInclude: [], wordTarget: 500, stopCondition: "Hook penutup terasa." },
      { beatNumber: 4, title: "Konsekuensi", summary: "Keputusan menimbulkan biaya langsung.", direction: "Tegaskan konsekuensi.", emotionalShift: "resolute → cemas", mustInclude: [], mustNotInclude: [], wordTarget: 450, stopCondition: "Biaya terasa." },
      { beatNumber: 5, title: "Penutup bab", summary: "Bab berakhir dengan pertanyaan terbuka.", direction: "Akhiri dengan cliffhanger aman.", emotionalShift: "cemas → penasaran", mustInclude: ["ending hook"], mustNotInclude: [], wordTarget: 400, stopCondition: "Cliffhanger jelas." },
    ],
    meta: { mock: true, hash: h },
  });
}

function buildMockChapterSummaryJson(input: ModelRouterGenerateInput): string {
  const h = input.promptHash.slice(0, 6);
  return JSON.stringify({
    synopsis: "Bab ini menutup satu konflik kecil sambil membuka taruhan yang lebih besar untuk pembaca. [mock:" + h + "]",
    miniVictory: "Karakter utama berhasil melewati rintangan pertama.",
    emotionalOutcome: "Dari ragu menjadi lebih tegas menghadapi risiko.",
    endingHook: "Sesuatu yang disembunyikan mulai terlihat di ambang bab berikutnya.",
    newFacts: [{ content: "Fakta kandidat dari naskah bab (mock).", category: "event", importance: "minor", confidence: 0.85 }],
    characterStateChanges: [{ characterName: "Protagonis", change: "Lebih berani mengambil sikap.", evidence: "Dialog penutup bab." }],
    relationshipChanges: [],
    openLoopUpdates: [{ question: "Apa yang sebenarnya terjadi?", status: "developed", note: "Tegangan meningkat." }],
    revealProgress: [{ title: "Petunjuk rahasia", status: "hinted", safeNote: "Hanya petunjuk, belum terungkap penuh." }],
    continuityWarnings: [],
  });
}

function buildDeterministicProse(input: ModelRouterGenerateInput): string {
  const hashPrefix = input.promptHash.slice(0, 8);
  if (input.generationType === GENERATION_TYPES.intake_assistant) {
    return (
      "Aku menangkap inti emosional ceritamu. Mari kita tajamkan siapa tokoh utama, " +
      "tekanan terbesar yang ia hadapi, dan rahasia apa yang perlu ditahan agar " +
      `pembaca terus penasaran. [mock-intake:${hashPrefix}]`
    );
  }
  if (input.generationType === GENERATION_TYPES.concept_generation) {
    return JSON.stringify([
      {
        title: "Rahasia di Balik Pintu",
        shortPitch:
          "Seorang ibu berusaha melindungi putrinya ketika masa lalu keluarga kembali menuntut jawaban. Setiap pilihan keselamatan justru membuka luka yang selama ini disembunyikan.",
        readerPromise:
          "Drama keluarga emosional dengan rahasia bertahap dan keputusan sulit di setiap bab.",
        coreConflict:
          "Tokoh utama harus memilih antara menjaga keutuhan keluarga atau mengungkap kebenaran yang dapat menghancurkan semuanya.",
        genre: "Drama Keluarga",
        tone: "Emosional dan menegangkan",
        targetReader: "Pembaca serial mobile",
        score: 88,
        payload: {
          badgeLabel: "Drama / Rahasia",
          badgeIcon: "key",
          whyReadersCare:
            "Pembaca mengikuti perjuangan seorang ibu yang menghadapi konsekuensi dari rahasia lama.",
          emotionalPromise:
            "Ketegangan keluarga, rasa bersalah, dan keberanian memilih kebenaran.",
          riskNotes: "Jaga pengungkapan rahasia tetap bertahap.",
          decorativeAccent: "primary-soft",
        },
      },
      {
        title: "Ibu yang Tak Pernah Menyerah",
        shortPitch:
          "Ketika keluarganya terancam pecah, seorang ibu yang selalu mengalah mulai melawan aturan yang membungkamnya. Perlawanan kecilnya mengubah hubungan dengan putri yang ingin ia lindungi.",
        readerPromise:
          "Perjalanan bangkit yang hangat, dekat, dan memuaskan dengan kemenangan kecil yang konsisten.",
        coreConflict:
          "Tokoh utama harus merebut kendali atas hidupnya tanpa kehilangan kepercayaan putrinya.",
        genre: "Drama Perempuan",
        tone: "Hangat dan penuh harapan",
        targetReader: "Pembaca serial mobile",
        score: 84,
        payload: {
          badgeLabel: "Bangkit / Keluarga",
          badgeIcon: "local_fire_department",
          whyReadersCare:
            "Transformasi tokoh utama memberi kepuasan emosional dan alasan kuat untuk terus membaca.",
          emotionalPromise:
            "Dari tertekan menjadi berani, tanpa kehilangan kelembutan hubungan ibu dan anak.",
          riskNotes: "Hindari perubahan karakter yang terlalu mendadak.",
          decorativeAccent: "secondary-container",
        },
      },
      {
        title: "Warisan Kebohongan",
        shortPitch:
          "Sebuah pesan lama membuat seorang putri curiga bahwa keluarganya dibangun di atas kebohongan. Sang ibu berpacu dengan waktu untuk menjelaskan masa lalu sebelum orang lain memelintir kebenaran.",
        readerPromise:
          "Misteri keluarga berlapis dengan petunjuk jelas, salah arah yang adil, dan payoff emosional.",
        coreConflict:
          "Kepercayaan ibu dan putri diuji ketika bukti masa lalu tampak bertentangan dengan cerita keluarga.",
        genre: "Misteri Keluarga",
        tone: "Penasaran dan intens",
        targetReader: "Pembaca serial mobile",
        score: 86,
        payload: {
          badgeLabel: "Misteri / Emosi",
          badgeIcon: "search",
          whyReadersCare:
            "Pertanyaan tentang siapa yang berbohong menciptakan dorongan kuat untuk membuka bab berikutnya.",
          emotionalPromise:
            "Kecurigaan berkembang menjadi pemahaman yang pahit namun melegakan.",
          riskNotes: "Pastikan setiap petunjuk punya fungsi dan payoff.",
          decorativeAccent: "success-soft",
        },
      },
    ]);
  }
  if (input.generationType === GENERATION_TYPES.beat_generation) {
    return buildMockBeatGenerationJson(input);
  }
  if (input.generationType === GENERATION_TYPES.chapter_summary_generation) {
    return buildMockChapterSummaryJson(input);
  }
  if (input.generationType === GENERATION_TYPES.prose_beat) {
    return `${MOCK_PROSE_BEAT_TEMPLATE}\n\n[mock:${hashPrefix}]`;
  }
  if (input.generationType === GENERATION_TYPES.prose_rewrite) {
    return `Versi yang lebih jernih dari adegan ini tetap mempertahankan fakta inti. [mock-rewrite:${hashPrefix}]`;
  }
  if (input.generationType === GENERATION_TYPES.publish_copy) {
    const requested = Array.isArray(input.metadata?.requestedFields)
      ? (input.metadata!.requestedFields as string[])
      : Object.values([
          "teaser",
          "caption",
          "readerQuestion",
          "shortSynopsis",
          "nextChapterTeaser",
        ]);
    const payload: Record<string, string> = {};
    for (const field of requested) {
      switch (field) {
        case "teaser":
          payload.teaser = `Hook singkat tanpa spoiler besar. [mock-publish:${hashPrefix}]`;
          break;
        case "caption":
          payload.caption =
            `Caption siap KBM — drama keluarga yang menggoda tanpa overclaim. [mock-publish:${hashPrefix}]`;
          break;
        case "readerQuestion":
          payload.readerQuestion = "Apa rahasia yang belum terungkap di bab ini?";
          break;
        case "shortSynopsis":
          payload.shortSynopsis =
            "Sinopsis singkat yang menegaskan konflik inti tanpa membocorkan twist besar.";
          break;
        case "nextChapterTeaser":
          payload.nextChapterTeaser = "Esok pagi, sebuah pesan mengubah segalanya.";
          break;
        default:
          break;
      }
    }
    return JSON.stringify(payload);
  }
  return `Mock output for ${input.generationType}. [mock:${hashPrefix}]`;
}

function estimateMockTokens(text: string): { input: number; output: number } {
  const words = text.split(/\s+/).filter(Boolean).length;
  return {
    input: Math.max(32, Math.floor(words * 0.6)),
    output: Math.max(16, words),
  };
}

/**
 * Deterministic local provider — no network. Used when AI_PROVIDER_MOCK=true.
 */
export async function generateWithMockProvider(
  input: ModelRouterGenerateInput,
  config: ResolvedModelConfig,
  mode: MockAiProviderMode,
): Promise<ModelRouterGenerateResult> {
  const started = Date.now();

  if (mode === "fail_provider") {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "Mock provider simulated a provider failure",
      502,
    );
  }

  const text =
    mode === "unsafe_output"
      ? "This output contains planningTruth leak marker for smoke testing."
      : buildDeterministicProse(input);

  const tokens = estimateMockTokens(text);

  return {
    text,
    provider: "mock",
    model: config.model,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    latencyMs: Date.now() - started,
    finishReason: "stop",
    promptHash: input.promptHash,
  };
}
