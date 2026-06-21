import assert from "node:assert/strict";
import { AppError } from "../src/errors.ts";
import { assertPlanningOutputSpecificToProject } from "../src/services/planning-output-specificity.ts";

assert.doesNotThrow(() => {
  assertPlanningOutputSpecificToProject(
    {
      title: "Legenda Pasar Terapung",
      shortPitch:
        "Seorang juru arsip muda menemukan peta rahasia yang menghubungkan pasar malam kotanya dengan janji keluarga yang belum ditepati.",
      payload: {
        whyReadersCare:
          "Konflik keluarga, misteri kota kecil, dan pilihan moral terasa langsung dari premis penulis.",
      },
    },
    "konsep",
  );
});

assert.throws(
  () => {
    assertPlanningOutputSpecificToProject(
      {
        title: "Nadira Mulai Diam",
        chapters: [{ summary: "Arman pulang terlambat dan Siska muncul sebagai rahasia lama." }],
      },
      "outline",
    );
  },
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "GENERATION_FAILED" &&
    err.status === 502 &&
    err.message.includes("nama template"),
);

console.log("PASS planning output specificity rejects template names");
