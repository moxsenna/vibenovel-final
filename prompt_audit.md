Kamu adalah senior software architect, product auditor, AI writing system architect, QA lead, dan technical project manager.



Konteks:

Saya sedang membangun ulang VibeNovel / Narraza sebagai AI Serial Fiction Production OS untuk penulis serial mobile Indonesia, khususnya gaya KBM/mobile serial.



Produk ini BUKAN:

- chatbot novel biasa

- one-click novel generator

- aplikasi yang membiarkan AI bebas menulis tanpa kontrol

- aplikasi yang langsung menjadikan output AI sebagai canon



Produk ini HARUS:

- membantu user dari ide mentah sampai publish package

- menjaga konsistensi cerita panjang

- mencegah AI membocorkan twist masa depan

- mengontrol siapa tahu apa dan kapan reveal boleh muncul

- menjaga karakter, timeline, style, dan voice

- mendukung format mobile/KBM

- membantu cerita punya hook, open loop, mini victory, dan daya unlock

- memakai backend-managed AI, bukan BYOK/default API key user

- memakai Canonical Story State sebagai source of truth



Prinsip wajib:

1. AI bukan source of truth.

2. Canonical Story State adalah source of truth.

3. Planner boleh tahu masa depan.

4. Writer hanya boleh tahu safe present.

5. Future outline tidak boleh masuk mentah ke writer prompt.

6. Context Packet Builder adalah satu-satunya pintu context ke AI writer.

7. AI-generated important facts harus masuk proposal dulu.

8. User approval diperlukan sebelum canon berubah.

9. Output AI tidak boleh langsung final.

10. Beat-level generation adalah default.

11. Chapter Delta wajib untuk update state.

12. Beginner Mode harus sederhana; Advanced Mode opt-in.

13. Jangan tampilkan raw model ID/API/provider ke user normal.

14. Jangan klaim “sekali klik jadi novel”, “tanpa edit”, atau “100% konsisten tanpa review”.



Tugas kamu:

Lakukan AUDIT FULL CODE, FULL PLAN, FULL PROGRESS, GAP ANALYSIS, dan RECOMMENDED NEXT ACTIONS.



PENTING:

- JANGAN coding dulu.

- JANGAN mengubah file aplikasi kecuali membuat/memperbarui file audit markdown.

- JANGAN mulai Sprint 2.

- JANGAN menambahkan backend, auth, Supabase, AI production, credit ledger, atau fitur baru.

- JANGAN refactor.

- JANGAN menghapus file.

- JANGAN membuat keputusan implementasi besar tanpa mencatat alasannya.

- Audit dulu secara menyeluruh, baru beri rekomendasi.



Tujuan audit:

Saya ingin tahu kondisi repo saat ini secara jujur:

- apa yang sudah selesai

- apa yang sebenarnya belum selesai

- apa yang hanya dummy/mock

- apa yang masih riskan

- apa yang konflik dengan blueprint

- apa yang perlu diperbaiki dulu

- apa yang harus masuk Sprint berikutnya

- apa yang harus ditunda

- apakah progress klaim sebelumnya cocok dengan kondisi code sebenarnya

- apakah rencana sprint sekarang masih masuk akal

- apakah aplikasi siap produksi apa belum



Sumber yang harus kamu baca:

1. README.md

2. package.json root

3. workspace/package files

4. apps/web

5. apps/api jika ada

6. packages/core jika ada

7. packages/shared jika ada

8. supabase folder jika ada

9. scripts folder jika ada

10. docs folder

11. .agents/rules jika ada

12. stitch-reference jika ada

13. semua sprint/report/checklist/decision docs yang relevan

14. file env example, config, tsconfig, vite config, tailwind config

15. legacy repo/folder/zip jika tersedia di workspace



Audit harus mencakup 12 area besar:



A. Repository Structure Audit

- Struktur folder aktual

- Monorepo setup

- Workspace setup

- Package boundaries

- Apakah apps/web, apps/api, packages/core, packages/shared, supabase, scripts sudah sesuai rencana

- File/folder yang redundant, kosong, placeholder, atau membingungkan

- Risiko maintainability



B. Documentation Audit

- Dokumen apa saja yang ada

- Dokumen mana yang menjadi source of truth

- Dokumen mana yang outdated

- Dokumen mana yang saling konflik

- Apakah current sprint plan cocok dengan dokumen blueprint

- Apakah agent rules cukup jelas

- Apakah ada missing docs penting sebelum Sprint 2



C. Sprint Progress Audit

Bandingkan klaim progress dengan kondisi code aktual.



Outputkan status:

- DONE

- PARTIAL

- MOCK ONLY

- NOT STARTED

- BLOCKED

- RISKY / NEEDS REVIEW



D. Frontend Audit

Audit apps/web secara detail:

- Routing

- AppShell

- Dashboard

- Start flow

- Intake page

- Concepts page

- Foundation page

- Outline page

- Write page desktop/mobile

- Summary page

- Publish page

- Settings page

- Mobile responsiveness

- Desktop whitespace

- Copywriting

- UI consistency

- Whether technical terms leak into Beginner Mode

- Whether raw model/provider info is shown

- Whether marketing overclaims appear

- Whether mock data is clearly isolated

- Whether there are hardcoded project IDs like demo-project-001

- Whether UI matches current sprint scope



E. Backend/API Audit

Jika apps/api ada:

- Struktur API

- Health endpoint

- Env validation

- Error format

- Supabase client usage

- Security risks

- Whether AI generation is accidentally client-side or unsafe

- Whether backend is placeholder only or functional



Jika apps/api belum ada:

- Catat sebagai not started, jangan bangun sekarang.



F. Shared/Core Package Audit

Cek packages/shared dan packages/core:

- Types yang ada

- Domain model yang ada

- Duplicated types antara web/shared/core

- Apakah sudah mendukung Project, StoryFoundation, Character, Fact, AiProposal, WriterPreference, CreditBalance

- Apakah Canonical Story State sudah ada atau belum

- Apakah type masih terlalu UI/mock-only



G. Database/Supabase Audit

Jika supabase folder ada:

- Migration files

- Schema design

- Tables existing/planned

- RLS notes

- Seed data

- Drift risk



Cek apakah schema sudah/akan mendukung:

- profiles

- projects

- project_settings

- story_foundations

- characters

- facts

- relationship_speech_rules

- ai_proposals

- credit_balances

- intake_sessions

- intake_messages

- detected_signals

- concepts

- seasons

- mini_arcs

- chapters

- chapter_beats

- reveals

- breadcrumbs

- open_loops

- reader_promises

- chapter_promises

- mini_victories

- prose_versions

- validation_reports

- chapter_deltas



Jika belum ada, catat sebagai future Sprint  sesuai rencana. Jangan implementasikan.



H. AI Architecture Safety Audit

Audit apakah kode/dokumen sudah menjaga prinsip:

- AI output penting harus proposal dulu

- AI tidak langsung mengubah canon

- writer tidak menerima hidden truth mentah

- future outline tidak masuk raw ke writer

- Context Packet Builder wajib sebelum writer

- Reveal Gate wajib sebelum prose

- Character Knowledge Gate wajib

- Validator + Repair wajib

- Chapter Delta wajib

- Accepted prose menjadi sumber lanjut cerita

- RAG tidak boleh jadi source of truth utama

- no client-side prompt/API key

- no raw model ID in normal UI



Tandai gap:

- Missing

- Planned only

- Partially designed

- Implemented

- Implemented but unsafe



I. Product / UX Fit Audit

Cek apakah repo saat ini menjawab persona:

1. User 0 writing skill

2. User punya ide kasar

3. User sudah punya draft

4. Advanced writer

5. Repair-only user



Cek apakah flow sudah sesuai:

- Aku belum punya ide

- Aku punya ide kasar

- Aku sudah punya draft

- Aku sudah punya outline

- Aku hanya mau memperbaiki cerita



Cek apakah Beginner Mode tetap ringan:

- Tidak banyak istilah teknis

- Tidak ada prompt engineering requirement

- User cukup klik/tulis sederhana

- Fondasi/outline/write/publish terasa guided



J. KBM / Retention System Audit

Audit apakah sistem sudah/akan menjawab masalah KBM:

- pembaca berhenti unlock

- cerita filler

- tokoh utama ditindas terus tanpa reward

- konflik datar

- open loop lupa dibayar

- ending bab lemah

- format tidak enak dibaca di HP

- penulis butuh teaser/caption/tag/comment bait



Cek keberadaan konsep:

- Reader Promise

- Chapter Promise

- Open Loop

- Payoff Scheduler

- Mini Victory

- Suffering Fatigue Detector

- Protagonist Agency Tracker

- Unlockability / Potensi Unlock

- Mobile readability

- Publish Package



K. Code Quality / Build / Test Audit

Jalankan command yang tersedia, tetapi jangan install package baru kecuali memang dependency sudah ada dan command normal gagal karena belum install.



Cek:

- npm install state jika perlu

- npm run typecheck

- npm run build

- npm run build:web jika ada

- npm run lint jika ada

- npm test jika ada

- broken imports

- unused/dead files

- TypeScript errors

- routing errors

- obvious runtime risks

- environment assumptions



Laporkan hasil command:

- command

- PASS/FAIL

- error utama

- file terkait

- rekomendasi fix



L. Security / Privacy / Cost Risk Audit

Cek:

- API key exposure

- localStorage API key

- raw prompt in frontend

- client-only AI generation

- env leakage

- service role leakage

- lack of RLS notes

- credit double charge risk

- model routing risk

- overgeneration cost risk

- no cost estimate risk

- no audit ledger risk



Output yang wajib dibuat:

Buat atau update folder docs/audit jika belum ada.



Buat file berikut:



1. docs/audit/00-audit-executive-summary.md

Isi:

- status repo dalam 1 halaman

- apakah siap lanjut atau belum

- top 10 finding

- top 10 risk

- rekomendasi next step

- final verdict:

  READY_FOR_TASK_1_17

  READY_FOR_SPRINT_1_5

  NOT_READY_NEEDS_FIX

  atau READY_FOR_SPRINT_2

Pilih satu verdict saja dengan alasan.



2. docs/audit/01-codebase-inventory.md

Isi:

- struktur folder

- package/workspace map

- route map

- module map

- docs map

- config/env map

- placeholder/mock map



3. docs/audit/02-progress-vs-plan.md

Isi tabel:

- Sprint/Task

- Claimed status

- Actual code status

- Evidence/file path

- Gap

- Recommendation



4. docs/audit/03-feature-gap-matrix.md

Isi:

- Feature

- Product importance

- Current status

- Missing parts

- Risk

- Target sprint

- Acceptance criteria



Wajib mencakup:

- Chat Story Agent

- 3 Concept Options

- Foundation Readiness

- Lock Foundation

- AI Proposal Queue

- Facts

- Relationship Speech Rules

- Target Length

- Outline 10 Bab

- Reveal Schedule

- Context Packet Builder

- Reveal Gate

- Character Knowledge

- Beat Writer

- Prose Versioning

- Validators

- Safe Repair

- Chapter Delta

- Publish Package

- Credit Estimate

- Credit Ledger

- Model Router



5. docs/audit/04-architecture-risk-report.md

Isi:

- risiko arsitektur terbesar

- bagian yang melanggar blueprint

- bagian yang masih terlalu mock

- bagian yang berpotensi membuat AI bocor future reveal

- bagian yang berpotensi membuat AI hallucinate canon

- bagian yang berpotensi membuat biaya AI jebol

- mitigation plan



6. docs/audit/05-problem-coverage-matrix.md

Isi matrix:

- 12 AI writing problem clusters

- masalah KBM/mobile serial

- fitur yang menjawab

- current implementation status

- target sprint

- acceptance criteria

- apakah sudah cukup atau belum



7. docs/audit/06-route-and-ui-audit.md

Isi:

- route

- purpose

- current status

- mock dependency

- UI issue

- mobile issue

- desktop issue

- copy issue

- recommended fix

- priority



8. docs/audit/07-testing-and-command-results.md

Isi:

- commands run

- result

- errors

- warnings

- follow-up required



9. docs/audit/08-recommended-next-sprint.md

Isi:

- apa yang harus dikerjakan berikutnya

- daftar task urut prioritas

- scope yang boleh

- scope yang dilarang

- acceptance criteria

- prompt siap pakai untuk next task



10. docs/audit/09-founder-readable-summary.md

Tulis dalam bahasa Indonesia yang mudah dipahami founder non-technical:

- kondisi sekarang

- apa yang sudah benar

- apa yang belum

- apa yang bahaya kalau langsung lanjut

- apa yang harus dikerjakan 1–3 langkah berikutnya



Format laporan:

- Gunakan bahasa Indonesia.

- Jujur dan spesifik.

- Jangan memberi pujian kosong.

- Jangan bilang selesai jika hanya mock.

- Pisahkan “sudah ada UI”, “sudah ada data”, “sudah ada backend”, “sudah ada AI production”.

- Setiap finding wajib menyebut file/path jika bisa.

- Jika tidak bisa memastikan, tulis “belum bisa dipastikan” dan jelaskan cara memastikannya.

- Jangan membuat klaim tanpa evidence.

- Jangan mengubah kode aplikasi.



Output akhir di chat:

Setelah selesai audit, berikan ringkasan:

1. Verdict

2. Top 10 findings

3. Top 10 risks

4. Apa yang sudah selesai

5. Apa yang masih mock

6. Apa yang kurang

7. Apa yang perlu diperbaiki dulu

8. File audit yang dibuat

9. Command test yang PASS/FAIL

10. Prompt next task yang direkomendasikan



Kriteria penting:

Audit ini harus membantu saya mengambil keputusan apakah:

- lanjut Legacy Audit

- ulang sebagian Sprint sekian

- atau baru mulai Sprint sekian



Jangan coding sebelum audit selesai.