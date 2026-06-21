#!/usr/bin/env node
/**
 * Docs ↔ code drift gate (Fase B). Exit 1 on forbidden stale doc strings or structural drift.
 * Stub markers in API services are reported as warnings only (exit 0) until Fase C.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readText(path) {
  return readFileSync(path, "utf8");
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (/\.(ts|tsx|mts|sql)$/.test(name)) acc.push(p);
  }
  return acc;
}

function grepInFiles(files, needle) {
  const re =
    typeof needle === "string"
      ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      : needle;
  const hits = [];
  for (const f of files) {
    const text = readText(f);
    if (re.test(text)) hits.push(relative(REPO_ROOT, f));
  }
  return hits;
}

const errors = [];
const warnings = [];

const SHIPPED_TABLES = [
  "mini_arcs",
  "timeline_events",
  "character_states",
  "character_knowledge",
  "import_jobs",
  "prose_embeddings",
];

const codeRoots = [
  join(REPO_ROOT, "packages/shared/src"),
  join(REPO_ROOT, "apps/api/src/services"),
];
const codeFiles = codeRoots.flatMap((d) => walkFiles(d));
const codeBlob = codeFiles.map(readText).join("\n");

for (const table of SHIPPED_TABLES) {
  const patterns = [table, `"${table}"`, `'${table}'`, `\`${table}\``];
  const found = patterns.some((p) => codeBlob.includes(p));
  if (!found) {
    errors.push(
      `Table "${table}" (migrations 00015–00017) not referenced in packages/shared or apps/api/src/services`,
    );
  }
}

const DOC_TARGETS = [
  join(REPO_ROOT, "docs/03-unified-feature-blueprint.md"),
  join(REPO_ROOT, "docs/08-character-state-timeline-and-memory.md"),
  join(REPO_ROOT, "docs/12-database-schema-and-data-model.md"),
];

const FORBIDDEN_SUBSTRINGS = [
  { label: "character_states table missing claim", text: "Belum ada tabel `character_states`" },
  { label: "character_knowledge table missing claim", text: "Belum ada tabel `character_knowledge`" },
  {
    label: "character_states/knowledge not implemented banner",
    text: "Character State/Knowledge/Timeline = **belum diimplementasikan**",
  },
  {
    label: "docs/12 planned-later character_states line",
    text: "character_states`, `character_knowledge` — planned later",
  },
];

for (const docPath of DOC_TARGETS) {
  if (!existsSync(docPath)) {
    errors.push(`Expected doc missing: ${relative(REPO_ROOT, docPath)}`);
    continue;
  }
  const content = readText(docPath);
  for (const { label, text } of FORBIDDEN_SUBSTRINGS) {
    if (content.includes(text)) {
      errors.push(`Stale doc [${label}] in ${relative(REPO_ROOT, docPath)}`);
    }
  }
}

const oldCreatorReport = join(REPO_ROOT, "docs/100-sprint-16-creator-mode-report.md");
const newCreatorReport = join(REPO_ROOT, "docs/101-sprint-16-creator-mode-report.md");
if (existsSync(oldCreatorReport)) {
  errors.push("docs/100-sprint-16-creator-mode-report.md must not exist (renamed to docs/101-...)");
}
if (!existsSync(newCreatorReport)) {
  errors.push("docs/101-sprint-16-creator-mode-report.md must exist");
}

const docs100 = readdirSync(join(REPO_ROOT, "docs")).filter(
  (f) =>
    f.startsWith("100-") &&
    f.endsWith(".md") &&
    f !== "100-competitive-manuscript-teardown-and-gap-sprint-plan.md",
);
if (docs100.length > 0) {
  errors.push(`Unexpected extra docs/100-*.md (only competitive allowed): ${docs100.join(", ")}`);
}

const audit12 = join(REPO_ROOT, "docs/audit/12-docs-code-truth-matrix-2026-06-16.md");
if (!existsSync(audit12)) {
  errors.push("docs/audit/12-docs-code-truth-matrix-2026-06-16.md must exist");
}

const serviceDir = join(REPO_ROOT, "apps/api/src/services");
const serviceFiles = walkFiles(serviceDir);
const STUB_MARKERS = [
  "beat_stub_deterministic",
  "summary_stub_v1",
  "outline_stub_deterministic",
  "foundation_stub_batch",
];

for (const marker of STUB_MARKERS) {
  const files = grepInFiles(serviceFiles, marker);
  if (files.length > 0) {
    warnings.push(`Stub marker "${marker}" still present in: ${files.join(", ")} (Fase C backlog)`);
  }
}

console.log("docs-code-drift-check\n");

if (warnings.length > 0) {
  console.log("WARNINGS (non-fatal):");
  for (const w of warnings) console.log(`  - ${w}`);
  console.log("");
}

if (errors.length > 0) {
  console.log("ERRORS (fatal):");
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}

console.log("PASS: no forbidden doc drift detected.");
process.exit(0);