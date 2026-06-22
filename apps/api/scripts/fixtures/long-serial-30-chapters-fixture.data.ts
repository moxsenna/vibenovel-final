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
        { id: "char-nadira", name: "Nadira", roleLabel: "Protagonis", descriptionSummary: "Seorang istri yang kuat dan tabah." },
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
      openLoopsActive: [],
      unresolvedThreadLabels: [],
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
