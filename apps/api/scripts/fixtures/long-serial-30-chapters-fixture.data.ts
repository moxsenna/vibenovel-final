/**
 * Deterministic 30-chapter fixture for acceptance testing.
 * 
 * Story: "Nadira" — a woman discovering family secrets.
 * - Main reveal at chapter 25
 * - 4 character knowledge transitions
 * - Physical injury spanning chapters 8-14
 * - Relationship improvement/regression scheduled
 * - Open loops with payoff
 * - Mini victories
 */
import type { WriterContextPacket } from "@vibenovel/shared";

export const FIXTURE_CHAPTER_COUNT = 30;
export const FIXTURE_REVEAL_CHAPTER = 25;
export const FIXTURE_REVEAL_BREADCRUMB_PREFIX = "breadcrumb-";
export const FIXTURE_KNOWLEDGE_TRANSITIONS = [
  { chapter: 4, characterId: "char-nadira", factId: "fact-letter", status: "suspects" },
  { chapter: 9, characterId: "char-sari", factId: "fact-letter", status: "knows" },
  { chapter: 16, characterId: "char-nadira", factId: "fact-letter", status: "partially_knows" },
  { chapter: 25, characterId: "char-nadira", factId: "fact-child", status: "knows" },
] as const;

export const FIXTURE_OPEN_LOOPS = [
  { id: "loop-letter", opened: 1, payoff: 9, status: "paid_off" },
  { id: "loop-injury", opened: 8, payoff: 15, status: "paid_off" },
  { id: "loop-child", opened: 3, payoff: 25, status: "paid_off" },
] as const;

export const FIXTURE_RELATIONSHIP_EVENTS = [
  { chapter: 6, change: "Nadira mulai mempercayai Arman" },
  { chapter: 12, change: "Kepercayaan Nadira mundur setelah kebohongan baru" },
  { chapter: 20, change: "Mereka bekerja sama melindungi Sari" },
] as const;

export function fixtureStateRows() {
  return [
    { chapter_number: 1, emotional_state: "waspada", physical_state: "sehat", current_goal: "mencari asal surat", location_label: "rumah" },
    { chapter_number: 8, emotional_state: "marah", physical_state: "pergelangan kaki terluka", current_goal: "keluar dari gudang", location_label: "gudang" },
    { chapter_number: 14, emotional_state: "tegar", physical_state: "pergelangan kaki masih nyeri", current_goal: "menghadapi Arman", location_label: "klinik" },
    { chapter_number: 15, emotional_state: "fokus", physical_state: "pulih", current_goal: "menemukan saksi", location_label: "rumah Sari" },
    { chapter_number: 25, emotional_state: "terpukul", physical_state: "pulih", current_goal: "memutuskan masa depan keluarga", location_label: "rumah lama" },
  ];
}

const BASE_TIME = "2026-06-20T00:00:00.000Z";

export function createFixturePacket(chapterNumber: number): WriterContextPacket {
  const isBeforeReveal = chapterNumber < FIXTURE_REVEAL_CHAPTER;
  const isRevealChapter = chapterNumber === FIXTURE_REVEAL_CHAPTER;

  return {
    meta: {
      projectId: "fixture-project",
      chapterOutlineId: `fixture-chapter-${chapterNumber}`,
      chapterNumber,
      builderVersion: "context_packet_v3",
      packetHash: `fixture-hash-${chapterNumber}`,
      generatedAt: BASE_TIME,
    },
    foundation: {
      premiseSummary: "Seorang istri menemukan rahasia keluarga yang mengubah segalanya.",
      mainConflictSummary: "Antara mempertahankan keluarga atau menuntut keadilan.",
      readerPromise: "Perjalanan emosional seorang perempuan yang bangkit.",
      tone: "melankolis",
      storySecretsPreview: isBeforeReveal ? null : "Rahasia terungkap di bab 25",
    },
    concept: {
      title: "Luka yang Dibayar Mahal",
      shortPitch: "Dia tidak lagi mau diam.",
      readerPromise: "Klimaks yang memuaskan.",
    },
    canon: {
      characters: [
        {
          id: "char-nadira",
          name: "Nadira",
          roleLabel: "Protagonis",
          descriptionSummary: "Seorang istri yang kuat dan tabah.",
          state: chapterNumber >= 15
            ? {
                chapterNumber: chapterNumber >= 25 ? 25 : 15,
                emotionalState: chapterNumber >= 25 ? "terpukul" : "fokus",
                physicalState: "pulih",
                currentGoal: chapterNumber >= 25 ? "memutuskan masa depan keluarga" : "menemukan saksi",
                locationLabel: chapterNumber >= 25 ? "rumah lama" : "rumah Sari",
              }
            : chapterNumber >= 8
              ? {
                  chapterNumber: chapterNumber >= 14 ? 14 : 8,
                  emotionalState: chapterNumber >= 14 ? "tegar" : "marah",
                  physicalState: chapterNumber >= 14
                    ? "pergelangan kaki masih nyeri"
                    : "pergelangan kaki terluka",
                  currentGoal: chapterNumber >= 14 ? "menghadapi Arman" : "keluar dari gudang",
                  locationLabel: chapterNumber >= 14 ? "klinik" : "gudang",
                }
              : {
                  chapterNumber: 1,
                  emotionalState: "waspada",
                  physicalState: "sehat",
                  currentGoal: "mencari asal surat",
                  locationLabel: "rumah",
                },
        },
        { id: "char-arman", name: "Arman", roleLabel: "Suami", descriptionSummary: "Suami Nadira, menyembunyikan sesuatu." },
        { id: "char-ibu", name: "Ibu Arman", roleLabel: "Ibu Mertua", descriptionSummary: "Ibu Arman yang dingin." },
        { id: "char-sari", name: "Sari", roleLabel: "Sahabat", descriptionSummary: "Sahabat Nadira." },
      ],
      facts: [
        isRevealChapter ? "Arman memiliki anak dari hubungan sebelumnya" : `Fakta bab ${chapterNumber}`,
        "Nadira menikah dengan Arman 5 tahun lalu",
      ],
      speechRules: [
        { id: "sr-1", relationshipLabel: "Nadira-Arman", ruleText: "Nadira berbicara sopan tapi dingin pada Arman", examples: [] },
      ],
    },
    currentChapter: {
      title: `Bab ${chapterNumber}`,
      summary: `Ringkasan bab ${chapterNumber}`,
      purpose: "Mengembangkan konflik",
      chapterFunction: "build_up",
      emotionalDirection: null,
      endingHook: chapterNumber < 30 ? `Hook bab ${chapterNumber}` : null,
      miniVictory: chapterNumber % 5 === 0 ? `Kemenangan kecil bab ${chapterNumber}` : null,
      hook: chapterNumber < 30 ? `Hook bab ${chapterNumber}` : null,
      markers: [],
    },
    continuity: {
      previousChapterSummaries: chapterNumber > 1 ? [`Ringkasan bab ${chapterNumber - 1}`] : [],
      openLoopsActive: FIXTURE_OPEN_LOOPS
        .filter((loop) => chapterNumber >= loop.opened && chapterNumber < loop.payoff)
        .map((loop) => ({
          id: loop.id,
          question: `Pertanyaan ${loop.id}`,
          readerFacingHint: "Petunjuk aman",
          status: "opened",
        })),
      unresolvedThreadLabels: [],
      recentTimeline: FIXTURE_RELATIONSHIP_EVENTS
        .filter((event) => event.chapter <= chapterNumber)
        .map((event) => `Bab ${event.chapter}: ${event.change}`),
      retrievalMemory: [{
        sourceRef: "imported-draft:chapter-0",
        text: "Nadira selalu mengetuk meja saat menahan marah.",
        similarity: 0.82,
        readOnly: true,
        usage: "context_only",
        metadata: {},
      }],
      povKnowledge: {
        characterId: "char-nadira",
        knownFacts: chapterNumber >= 25
          ? [{ factId: "fact-child", text: "Arman memiliki anak dari hubungan sebelumnya", confidence: 1, learnedAtChapter: 25 }]
          : [],
        suspectedFacts: chapterNumber >= 4 && chapterNumber < 16
          ? [{ factId: "fact-letter", text: "Arman terkait dengan surat lama", confidence: 0.55, learnedAtChapter: 4 }]
          : [],
        partialFacts: chapterNumber >= 16 && chapterNumber < 25
          ? [{ factId: "fact-letter", text: "Surat lama berkaitan dengan keluarga Arman", confidence: 0.8, learnedAtChapter: 16 }]
          : [],
        falseBeliefs: chapterNumber < 12
          ? [
              { factId: "belief-1", text: "Sari menulis surat itu", confidence: 0.6, learnedAtChapter: 2 },
              { factId: "belief-2", text: "Ibu Arman ingin Nadira pergi demi warisan", confidence: 0.5, learnedAtChapter: 3 },
            ]
          : [],
        unknownFactCount: chapterNumber < 25 ? 1 : 0,
      },
      knowledgeByCharacter: [],
      precedingProseTail: chapterNumber > 1
        ? {
            text: `Ekor prosa current bab ${chapterNumber - 1}.`,
            sourceChapterNumber: chapterNumber - 1,
            sourceBeatId: `beat-${chapterNumber - 1}-last`,
            sourceVersionId: `version-${chapterNumber - 1}-current`,
            sourceType: "previous_chapter_last_beat",
          }
        : null,
      styleRules: ["Paragraph length target: short", "Forbidden style: head hopping"],
    },
    revealGate: {
      allowedBreadcrumbs: isBeforeReveal ? [`${FIXTURE_REVEAL_BREADCRUMB_PREFIX}${chapterNumber}`] : [],
      allowedReveals: isRevealChapter ? [{ id: "reveal-main", title: "Rahasia Arman", readerFacingHint: "Arman menyembunyikan sesuatu yang besar" }] : [],
      forbiddenReveals: isBeforeReveal ? [{ id: "reveal-main", label: "Rahasia Arman", forbiddenConcepts: ["anak rahasia", "masa lalu arman"] }] : [],
      forbiddenConcepts: isBeforeReveal ? ["anak rahasia", "masa lalu arman"] : [],
    },
    emotionalTarget: {
      chapterEmotion: chapterNumber <= 15 ? "tense" : "hopeful",
      beatEmotionalShift: null,
    },
    hookTarget: {
      chapterEndingHook: chapterNumber < 30 ? `Hook bab ${chapterNumber}` : null,
      beatStopCondition: null,
    },
    constraints: {
      mustInclude: chapterNumber === 25 ? ["anak", "rahasia"] : [],
      mustNotInclude: isBeforeReveal ? ["anak rahasia"] : [],
      wordTarget: 500,
      mobileFormatRules: ["Format HP/KBM: paragraf 1-3 kalimat."],
    },
  };
}

export function getExpectedRevealChapter(): number {
  return FIXTURE_REVEAL_CHAPTER;
}
