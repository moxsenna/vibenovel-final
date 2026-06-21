import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homepage = readFileSync("../../apps/homepage/index.html", "utf8");
const vision = readFileSync("../../docs/01-product-vision-and-positioning.md", "utf8");
const combined = `${homepage}\n${vision}`;

for (const unsupported of [
  "500+ Bab",
  "ratusan bab",
  "ingat seluruh cerita",
  "Kanon berlaku konsisten hingga ratusan bab",
  "Deteksi otomatis saat tulisan bertentangan dengan kanon",
]) {
  assert.doesNotMatch(combined, new RegExp(unsupported, "i"));
}

assert.match(
  homepage,
  /Memori cerita terstruktur untuk membantu menjaga detail penting/i,
);
assert.match(
  homepage,
  /pemeriksaan otomatis untuk sejumlah konflik canon dan continuity/i,
);
assert.doesNotMatch(combined, /Diuji pada alur serial 30 bab/i);

console.log("PASS marketing claims remain within verified evidence");
