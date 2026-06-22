import { PLANNED_REVEAL_STATUSES } from "@vibenovel/shared";
import type { PromptMessage } from "./ai-generation-types.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";
import type { BeatGenerationSnapshot } from "./beat-generation-snapshot.js";

const ACTIVE_REVEAL_STATUSES = new Set<string>([
  PLANNED_REVEAL_STATUSES.planned,
  PLANNED_REVEAL_STATUSES.armed,
  PLANNED_REVEAL_STATUSES.revealed,
  PLANNED_REVEAL_STATUSES.delayed,
]);

const MAX_CHARS = 12;
const MAX_FACTS = 20;
const MAX_LOOPS = 8;
const MAX_PRIOR_SUMMARIES = 10;
const MAX_TIMELINE = 15;

export interface BeatAiDraft {
  beatNumber: number;
  title: string;
  summary: string;
  direction: string;
  emotionalShift: string;
  mustInclude: string[];
  mustNotInclude: string[];
  wordTarget: number;
  stopCondition: string;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildSystemPrompt(): string {
  return (
    "Kamu adalah perencana beat bab untuk novel serial Indonesia (HP/KBM). " +
    "Hasilkan SATU object JSON valid dengan struktur:\n" +
    "{\n" +
    '  "beats": [\n' +
    "    {\n" +
    '      "beatNumber": 1,\n' +
    '      "title": "judul beat",\n' +
    '      "summary": "ringkasan adegan",\n' +
    '      "direction": "arah penulisan untuk penulis",\n' +
    '      "emotionalShift": "pergeseran emosi",\n' +
    '      "mustInclude": ["elemen wajib"],\n' +
    '      "mustNotInclude": ["larangan"],\n' +
    '      "wordTarget": 350,\n' +
    '      "stopCondition": "kapan beat selesai"\n' +
    "    }\n" +
    "  ]\n" +
    "}\n\n" +
    "Aturan: 5–8 beat berurutan yang menutup satu bab; selaras dengan outline bab dan canon; " +
    "jangan bocorkan rahasia yang dilarang sebelum bab ini; spesifik ke proyek (bukan template generik); " +
    "wordTarget antara 250–600 per beat; hanya JSON, tanpa markdown atau teks lain."
  );
}

function buildUserPrompt(snapshot: BeatGenerationSnapshot): string {
  const ch = snapshot.currentChapter;
  const f = snapshot.foundation;

  const charLines = snapshot.characters
    .slice(0, MAX_CHARS)
    .map((c) => `- ${c.name} (${c.role}): ${truncate(c.description, 200)}`)
    .join("\n");

  const factLines = snapshot.facts
    .slice(0, MAX_FACTS)
    .map((fact) => `- ${truncate(fact.text, 300)}`)
    .join("\n");

  const loopLines = snapshot.activeOpenLoops
    .slice(0, MAX_LOOPS)
    .map((loop) => `- ${loop.question}${loop.readerFacingHint ? ` (${loop.readerFacingHint})` : ""}`)
    .join("\n");

  const revealLines = snapshot.safePlannedReveals
    .filter((r) => ACTIVE_REVEAL_STATUSES.has(r.status))
    .map((r) => {
      const forbiddenBefore = r.forbidden_before_chapter ?? Number.MAX_SAFE_INTEGER;
      const allowed =
        forbiddenBefore <= ch.chapterNumber
          ? `boleh breadcrumb: ${r.reader_facing_hint ?? r.title}`
          : `DILARANG sebelum bab ${forbiddenBefore}: ${r.title}`;
      return `- ${allowed}`;
    })
    .join("\n");

  const speechLines = snapshot.speechRules
    .slice(0, 10)
    .map(
      (rule) =>
        `${rule.characterAId} ↔ ${rule.characterBId}: ${truncate(rule.ruleText, 120)}`,
    )
    .join("\n");

  const priorLines = snapshot.priorChapterSummaries
    .slice(-MAX_PRIOR_SUMMARIES)
    .map((p) => `Bab ${p.chapterNumber} — ${p.title}: ${truncate(p.synopsis, 400)}`)
    .join("\n");

  const timelineLines = snapshot.pastTimelineEvents
    .slice(-MAX_TIMELINE)
    .map((ev) => `Bab ${ev.chapterNumber}: ${truncate(ev.event, 200)}`)
    .join("\n");

  const outlineBlock = [
    `Bab ${ch.chapterNumber}: ${ch.title}`,
    `Ringkasan outline: ${ch.summary}`,
    ch.purpose ? `Tujuan: ${ch.purpose}` : null,
    ch.hook ? `Hook: ${ch.hook}` : null,
    ch.endingHook ? `Ending hook: ${ch.endingHook}` : null,
    ch.emotionalDirection ? `Arah emosi: ${ch.emotionalDirection}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const foundationBlock = [
    `Premis: ${f.premise}`,
    `Konflik: ${f.main_conflict}`,
    `Janji pembaca: ${f.reader_promise}`,
    `Konsep: ${snapshot.concept.title}`,
    `Musim: ${snapshot.outlinePlan.season_label ?? ""}`,
  ].join("\n");

  return [
    `Rencanakan beat untuk bab ini:\n${outlineBlock}`,
    `\nFondasi:\n${foundationBlock}`,
    `\nTokoh:\n${charLines || "(tidak ada)"}`,
    `\nFakta canon:\n${factLines || "(tidak ada)"}`,
    `\nAturan dialog:\n${speechLines || "(tidak ada)"}`,
    `\nOpen loop aktif:\n${loopLines || "(tidak ada)"}`,
    `\nReveal gate (reader-safe, tanpa planning truth):\n${revealLines || "(tidak ada)"}`,
    priorLines ? `\nRingkasan bab sebelumnya:\n${priorLines}` : "",
    timelineLines ? `\nTimeline masa lalu:\n${timelineLines}` : "",
  ]
    .filter((part) => part.length > 0)
    .join("");
}

export async function buildBeatGenerationPromptMessages(
  snapshot: BeatGenerationSnapshot,
): Promise<{ promptMessages: PromptMessage[]; promptHash: string }> {
  const promptMessages: PromptMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(snapshot) },
  ];
  const promptHash = await computePromptHashFromMessages(promptMessages);
  return { promptMessages, promptHash };
}

export function stripBeatJsonFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}