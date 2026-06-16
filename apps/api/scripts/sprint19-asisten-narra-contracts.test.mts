import assert from "node:assert/strict";
import {
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  FOUNDATION_READINESS_LEVELS,
  INTAKE_PHASES,
  LOCK_READINESS_MIN_SCORE,
  REFINE_READINESS_MIN_SCORE,
} from "@vibenovel/shared";
import { computeFoundationReadiness } from "../src/services/foundation-readiness.ts";

assert.equal(INTAKE_PHASES.foundation_refinement, "foundation_refinement");
assert.equal(FOUNDATION_READINESS_LEVELS.siap_dimatangkan, "siap_dimatangkan");
assert.equal(FOUNDATION_READINESS_LEVELS.sangat_siap, "sangat_siap");
assert.equal(REFINE_READINESS_MIN_SCORE, 75);
assert.equal(LOCK_READINESS_MIN_SCORE, 85);

const structuralConcept = {
  id: "concept-19-structural",
  project_id: "project-19",
  title: "Judul Uji Struktural",
  short_pitch: "Tokoh utama memulai hidup baru setelah kesalahan lama.",
  reader_promise: "Kisah memberi pengalaman mengikuti perubahan tokoh.",
  core_conflict: "Pilihan sulit membuat tokoh utama ragu.",
  genre: "Drama",
  tone: "Tenang",
  target_reader: "hp_serial",
  status: "selected",
  source: "system",
  score: 80,
  payload: {},
  created_at: "2026-06-16T00:00:00.000Z",
  updated_at: "2026-06-16T00:00:00.000Z",
} as Parameters<typeof computeFoundationReadiness>[1];

const structuralRows = [
  {
    id: "proposal-foundation-structural",
    project_id: "project-19",
    proposal_type: AI_PROPOSAL_TYPES.foundation,
    status: AI_PROPOSAL_STATUSES.accepted,
    risk_level: "low",
    source: "ai_import",
    title: "Fondasi struktural",
    payload: {
      premise: structuralConcept.short_pitch,
      mainConflict: structuralConcept.core_conflict,
      readerPromise: structuralConcept.reader_promise,
      genre: structuralConcept.genre,
      tone: structuralConcept.tone,
      targetReader: structuralConcept.target_reader,
    },
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    merged_into_id: null,
    result_fact_id: null,
    result_character_id: null,
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "proposal-protagonist-structural",
    project_id: "project-19",
    proposal_type: AI_PROPOSAL_TYPES.character,
    status: AI_PROPOSAL_STATUSES.accepted,
    risk_level: "low",
    source: "ai_import",
    title: "Tokoh Utama",
    payload: {
      name: "Tokoh Utama",
      role: "protagonist",
      description: "Tokoh pusat cerita.",
    },
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    merged_into_id: null,
    result_fact_id: null,
    result_character_id: null,
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "proposal-fact-structural-1",
    project_id: "project-19",
    proposal_type: AI_PROPOSAL_TYPES.fact,
    status: AI_PROPOSAL_STATUSES.accepted,
    risk_level: "medium",
    source: "ai_import",
    title: "Fakta: identitas",
    payload: {
      content: "Tokoh utama adalah pusat cerita.",
      category: "identity",
      importance: "core",
    },
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    merged_into_id: null,
    result_fact_id: null,
    result_character_id: null,
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "proposal-fact-structural-2",
    project_id: "project-19",
    proposal_type: AI_PROPOSAL_TYPES.fact,
    status: AI_PROPOSAL_STATUSES.accepted,
    risk_level: "medium",
    source: "ai_import",
    title: "Fakta: kejadian awal",
    payload: {
      content: "Sebuah kejadian lama menjadi awal cerita.",
      category: "event",
      importance: "major",
    },
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    merged_into_id: null,
    result_fact_id: null,
    result_character_id: null,
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  },
] as Parameters<typeof computeFoundationReadiness>[2];

const structuralReady = computeFoundationReadiness(
  null,
  structuralConcept,
  structuralRows,
  [],
  [],
  [],
  false,
  {
    activeStatuses: new Set(["accepted"]),
    acceptedCountsAsReady: true,
    persist: false,
  },
);

assert.equal(structuralReady.readinessScore, REFINE_READINESS_MIN_SCORE);
assert.equal(structuralReady.canRefine, true);
assert.equal(structuralReady.canLock, false);
assert.equal(structuralReady.readinessLevel, FOUNDATION_READINESS_LEVELS.siap_dimatangkan);

const matureConcept = {
  id: "concept-19-mature",
  project_id: "project-19",
  title: "Meja Makan yang Selalu Genap",
  short_pitch:
    "Rani menjaga rumah tetap terlihat utuh saat suaminya menyembunyikan kehilangan kerja dan utang keluarga.",
  reader_promise:
    "Pembaca mengikuti bongkar kebohongan rumah tangga yang pelan, emosional, dan dekat dengan realitas keluarga urban.",
  core_conflict:
    "Rani harus memilih antara menjaga rumah tetap rapi atau membongkar kebohongan finansial Bima dan campur tangan mertuanya.",
  genre: "Drama rumah tangga",
  tone: "Emosional, realistis, tegang pelan",
  target_reader: "hp_serial",
  status: "selected",
  source: "system",
  score: 90,
  payload: {},
  created_at: "2026-06-16T00:00:00.000Z",
  updated_at: "2026-06-16T00:00:00.000Z",
} as Parameters<typeof computeFoundationReadiness>[1];

const matureRows = structuralRows.map((row) => ({ ...row, project_id: "project-19-mature" }));
matureRows[0] = {
  ...matureRows[0],
  id: "proposal-foundation-mature",
  payload: {
    premise: matureConcept.short_pitch,
    mainConflict: matureConcept.core_conflict,
    readerPromise: matureConcept.reader_promise,
    genre: matureConcept.genre,
    tone: matureConcept.tone,
    targetReader: matureConcept.target_reader,
  },
};
matureRows[1] = {
  ...matureRows[1],
  id: "proposal-protagonist-mature",
  title: "Tokoh Utama - Rani",
  payload: {
    name: "Rani Pradipta",
    role: "protagonist",
    description:
      "Pemilik katering rumahan yang menahan perasaan demi rumah tetap terlihat baik-baik saja.",
    motivation: "Melindungi anaknya tanpa terus menjadi penyangga kebohongan suaminya.",
  },
};
matureRows[2] = {
  ...matureRows[2],
  id: "proposal-fact-mature-1",
  payload: {
    content: "Bima kehilangan pekerjaan enam bulan lalu dan menutupinya dari Rani.",
    category: "event",
    importance: "core",
  },
};
matureRows[3] = {
  ...matureRows[3],
  id: "proposal-fact-mature-2",
  payload: {
    content: "Tabungan keluarga Rani berkurang karena utang yang Bima sembunyikan.",
    category: "event",
    importance: "major",
  },
};

const matureReady = computeFoundationReadiness(
  null,
  matureConcept,
  matureRows,
  [],
  [],
  [],
  false,
  {
    activeStatuses: new Set(["accepted"]),
    acceptedCountsAsReady: true,
    persist: false,
  },
);

assert.equal(matureReady.readinessScore >= LOCK_READINESS_MIN_SCORE, true);
assert.equal(matureReady.canLock, true);
assert.equal(
  [FOUNDATION_READINESS_LEVELS.siap_dikunci, FOUNDATION_READINESS_LEVELS.sangat_siap].includes(
    matureReady.readinessLevel,
  ),
  true,
);

console.log("PASS Sprint 19 Asisten Narra contracts");
