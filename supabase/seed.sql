-- =============================================================================
-- VibeNovel Sprint 2+ — Dev/demo seed (Task 2.4, extended Task 3.1)
-- Maps Sprint 1 mocks → local DB. Idempotent: safe after `supabase db reset`.
-- Canon: facts = confirmed only; AI suggestions → ai_proposals (proposed).
-- Sprint 3 tables (intake/concepts) are NOT canon.
-- =============================================================================

-- Fixed UUIDs (repeatable; demo-project-001 concept → DEMO_PROJECT_ID)
-- User: a0000000-0000-4000-8000-000000000001
-- Project: a0000000-0000-4000-8000-000000000101

-- -----------------------------------------------------------------------------
-- Dev auth user (profiles FK requires auth.users)
-- Local-only; not for production. No service keys or API secrets in this file.
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'penulis@contoh.id',
  crypt('vibenovel-local-dev-seed', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Penulis VibeNovel"}',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  '{"sub":"a0000000-0000-4000-8000-000000000001","email":"penulis@contoh.id"}'::jsonb,
  'email',
  'a0000000-0000-4000-8000-000000000001',
  now(),
  now(),
  now()
)
ON CONFLICT (provider_id, provider) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
INSERT INTO public.profiles (
  id,
  display_name,
  email,
  default_language,
  plan_label,
  role,
  subscription_plan
)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Penulis VibeNovel',
  'penulis@contoh.id',
  'id',
  'Free Plan',
  'writer',
  'free'
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  plan_label = EXCLUDED.plan_label,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- projects — Istri yang Mereka Buang (active)
-- -----------------------------------------------------------------------------
INSERT INTO public.projects (
  id,
  owner_id,
  title,
  genre,
  status,
  current_chapter,
  entry_path,
  is_active,
  last_edited_at
)
VALUES (
  'a0000000-0000-4000-8000-000000000101',
  'a0000000-0000-4000-8000-000000000001',
  'Istri yang Mereka Buang',
  'Drama Misteri',
  'in_progress',
  1,
  'rough_idea',
  true,
  '2026-06-05T14:30:00+07:00'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  genre = EXCLUDED.genre,
  status = EXCLUDED.status,
  current_chapter = EXCLUDED.current_chapter,
  is_active = EXCLUDED.is_active,
  last_edited_at = EXCLUDED.last_edited_at,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- project_settings
-- -----------------------------------------------------------------------------
INSERT INTO public.project_settings (
  id,
  project_id,
  quality_tier,
  output_style_preference,
  default_format
)
VALUES (
  'a0000000-0000-4000-8000-000000000102',
  'a0000000-0000-4000-8000-000000000101',
  'seimbang',
  'warm_emotional',
  'hp_kbm'
)
ON CONFLICT (project_id) DO UPDATE SET
  quality_tier = EXCLUDED.quality_tier,
  output_style_preference = EXCLUDED.output_style_preference,
  default_format = EXCLUDED.default_format,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- story_foundations
-- -----------------------------------------------------------------------------
INSERT INTO public.story_foundations (
  id,
  project_id,
  premise,
  main_conflict,
  reader_promise,
  genre,
  target_reader,
  story_secrets_preview,
  style_tags,
  readiness_percent,
  readiness_status,
  status,
  is_locked
)
VALUES (
  'a0000000-0000-4000-8000-000000000103',
  'a0000000-0000-4000-8000-000000000101',
  'Nadira, istri yang selama ini diremehkan keluarga suaminya, mulai curiga ketika jejak pengkhianatan Arman terkuak. Di tengah penghinaan dan tekanan, dia perlahan mengumpulkan bukti dan merencanakan bangkit.',
  'Nadira terjebak antara bertahan demi anak-anak atau menghadapi pengkhianatan dan penghinaan keluarga — sambil membangun kekuatan untuk bangkit tanpa kehilangan harga dirinya.',
  E'Pengkhianatan yang menusuk dan terasa dekat dengan kehidupan sehari-hari\nProses bangkit yang perlahan tapi memuaskan dibaca\nPenyesalan orang yang pernah meremehkan Nadira\nBalas dendam emosional yang terasa adil, bukan instan',
  'Drama Misteri',
  'hp_serial',
  'Siska bukan sekadar nama asing — dia terhubung dengan masa lalu Arman yang sengaja disembunyikan dari Nadira.',
  '["Drama Rumah Tangga","Revenge Emosional","POV Perempuan","Serial Bab Pendek"]'::jsonb,
  82,
  'bisa_lanjut',
  'draft',
  false
)
ON CONFLICT (project_id) DO UPDATE SET
  premise = EXCLUDED.premise,
  main_conflict = EXCLUDED.main_conflict,
  reader_promise = EXCLUDED.reader_promise,
  story_secrets_preview = EXCLUDED.story_secrets_preview,
  style_tags = EXCLUDED.style_tags,
  readiness_percent = EXCLUDED.readiness_percent,
  readiness_status = EXCLUDED.readiness_status,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- characters
-- -----------------------------------------------------------------------------
INSERT INTO public.characters (
  id, project_id, name, role_label, role, description, importance, status, source, sort_order
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000101',
    'Nadira',
    'Tokoh Utama',
    'protagonist',
    'Istri yang diremehkan namun mulai bangkit dan mengambil kendali atas hidupnya.',
    'main',
    'active',
    'system_seed',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000202',
    'a0000000-0000-4000-8000-000000000101',
    'Arman',
    'Suami',
    'supporting',
    'Suami yang tidak membela Nadira dan menyimpan rahasia dari masa lalunya.',
    'main',
    'active',
    'system_seed',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000203',
    'a0000000-0000-4000-8000-000000000101',
    'Bu Siti',
    'Ibu Mertua',
    'supporting',
    'Anggota keluarga yang kerap merendahkan Nadira di depan orang lain.',
    'supporting',
    'active',
    'system_seed',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000204',
    'a0000000-0000-4000-8000-000000000101',
    'Siska',
    'Tokoh Penting',
    'supporting',
    'Wanita dari masa lalu Arman yang kembali menghantui rumah tangga mereka.',
    'supporting',
    'active',
    'system_seed',
    3
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role_label = EXCLUDED.role_label,
  description = EXCLUDED.description,
  importance = EXCLUDED.importance,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- facts (confirmed canon only — from lockedFacts mock, source system_seed)
-- -----------------------------------------------------------------------------
INSERT INTO public.facts (
  id, project_id, text, category, importance, canon_status, is_locked, source
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000301',
    'a0000000-0000-4000-8000-000000000101',
    'Nadira adalah tokoh utama.',
    'identity',
    'core',
    'confirmed',
    true,
    'system'
  ),
  (
    'a0000000-0000-4000-8000-000000000302',
    'a0000000-0000-4000-8000-000000000101',
    'Arman adalah suami yang tidak membela Nadira.',
    'relationship',
    'major',
    'confirmed',
    true,
    'system'
  ),
  (
    'a0000000-0000-4000-8000-000000000303',
    'a0000000-0000-4000-8000-000000000101',
    'Keluarga Arman meremehkan Nadira.',
    'family',
    'major',
    'confirmed',
    true,
    'system'
  ),
  (
    'a0000000-0000-4000-8000-000000000304',
    'a0000000-0000-4000-8000-000000000101',
    'Konflik utama dimulai dari pengkhianatan dan penghinaan keluarga.',
    'event',
    'core',
    'confirmed',
    true,
    'system'
  )
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text,
  category = EXCLUDED.category,
  importance = EXCLUDED.importance,
  is_locked = EXCLUDED.is_locked,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- relationship_speech_rules
-- -----------------------------------------------------------------------------
INSERT INTO public.relationship_speech_rules (
  id,
  project_id,
  relationship_label,
  character_a_id,
  character_b_id,
  rule_text,
  examples,
  status,
  source
)
VALUES (
  'a0000000-0000-4000-8000-000000000401',
  'a0000000-0000-4000-8000-000000000101',
  'Nadira ↔ Bu Siti',
  'a0000000-0000-4000-8000-000000000201',
  'a0000000-0000-4000-8000-000000000203',
  'Bu Siti memanggil Nadira dengan nada merendahkan; Nadira tetap sopan tetapi menjawab singkat dan dingin.',
  '["Bu Siti: Kau masih belajar jadi istri yang baik, Nak.","Nadira: Iya, Bu."]'::jsonb,
  'active',
  'user'
)
ON CONFLICT (id) DO UPDATE SET
  rule_text = EXCLUDED.rule_text,
  examples = EXCLUDED.examples,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- ai_proposals (proposed — NOT promoted to facts)
-- High-risk suggestion about masa lalu romantis — stays in queue
-- -----------------------------------------------------------------------------
INSERT INTO public.ai_proposals (
  id,
  project_id,
  proposal_type,
  status,
  risk_level,
  source,
  title,
  payload
)
VALUES (
  'a0000000-0000-4000-8000-000000000501',
  'a0000000-0000-4000-8000-000000000101',
  'fact',
  'proposed',
  'high',
  'system_seed',
  'Siska pernah dekat dengan Arman sebelum pernikahan',
  '{"suggested_text":"Siska dan Arman pernah memiliki hubungan dekat yang disembunyikan dari keluarga.","category":"relationship","high_risk_category":"masa_lalu_romantis"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  payload = EXCLUDED.payload,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- credit_balances (display-only Sprint 2)
-- -----------------------------------------------------------------------------
INSERT INTO public.credit_balances (
  id,
  user_id,
  balance,
  monthly_quota,
  monthly_used,
  reset_at,
  source
)
VALUES (
  'a0000000-0000-4000-8000-000000000601',
  'a0000000-0000-4000-8000-000000000001',
  1250,
  1000,
  450,
  '2026-07-01'::date,
  'seed'
)
ON CONFLICT (user_id) DO UPDATE SET
  balance = EXCLUDED.balance,
  monthly_quota = EXCLUDED.monthly_quota,
  monthly_used = EXCLUDED.monthly_used,
  reset_at = EXCLUDED.reset_at,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- audit_logs (light seed events — no secrets or full AI payloads)
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_logs (
  id, user_id, project_id, action, entity_type, entity_id, metadata
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000701',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'project_created',
    'project',
    'a0000000-0000-4000-8000-000000000101',
    '{"title":"Istri yang Mereka Buang","source":"seed"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000702',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'foundation_created',
    'story_foundation',
    'a0000000-0000-4000-8000-000000000103',
    '{"readiness_percent":82,"source":"seed"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000703',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    'credit_balance_seeded',
    'credit_balance',
    'a0000000-0000-4000-8000-000000000601',
    '{"balance":1250,"source":"seed"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Sprint 3 — intake session (demo project; maps mockIntakeSession)
-- -----------------------------------------------------------------------------
INSERT INTO public.intake_sessions (
  id,
  project_id,
  status,
  phase,
  progress_percent,
  summary,
  metadata
)
VALUES (
  'a0000000-0000-4000-8000-000000000801',
  'a0000000-0000-4000-8000-000000000101',
  'completed',
  'foundation_preparation',
  40,
  'Drama rumah tangga — istri diremehkan, berjuang bangkit.',
  '{"source":"seed","mock_ref":"mockIntakeSession"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  phase = EXCLUDED.phase,
  progress_percent = EXCLUDED.progress_percent,
  summary = EXCLUDED.summary,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- intake_messages (3 messages from Sprint 1 mock)
-- -----------------------------------------------------------------------------
INSERT INTO public.intake_messages (
  id, project_id, session_id, role, content, metadata, created_at
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000811',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'agent',
    'Halo! Aku siap mendampingi kamu merangkai rasa cerita. Untuk memulai, ceritakan gambaran kasarmu — tidak perlu sempurna.',
    '{"mock_id":"msg-001"}'::jsonb,
    '2026-06-05T10:00:00+07:00'::timestamptz
  ),
  (
    'a0000000-0000-4000-8000-000000000812',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'user',
    'Aku mau tulis drama rumah tangga tentang istri yang diremehkan keluarga suami, lalu perlahan bangkit dan menemukan keberanian sendiri. Ceritanya emosional dan enak dibaca di HP.',
    '{"mock_id":"msg-002"}'::jsonb,
    '2026-06-05T10:02:00+07:00'::timestamptz
  ),
  (
    'a0000000-0000-4000-8000-000000000813',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'agent',
    'Rasa ceritanya sudah terasa kuat — drama rumah tangga dengan perjalanan harga diri. Aku catat sebagai Drama Rumah Tangga dengan nuansa Bangkit & Berani.

Bisa ceritakan sedikit tentang tokoh utama? Siapa perempuan di pusat cerita ini, dan apa yang paling menyakitkan baginya?',
    '{"mock_id":"msg-003"}'::jsonb,
    '2026-06-05T10:03:00+07:00'::timestamptz
  )
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  metadata = EXCLUDED.metadata;

-- -----------------------------------------------------------------------------
-- detected_signals (from mockIntakeSession.detectedSignals)
-- -----------------------------------------------------------------------------
INSERT INTO public.detected_signals (
  id, project_id, session_id, type, label, value, confidence, status, source_message_id, metadata
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000821',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'genre',
    'Drama Rumah Tangga',
    'drama rumah tangga',
    0.850,
    'confirmed',
    'a0000000-0000-4000-8000-000000000812',
    '{"icon":"theater_comedy"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000822',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'tone',
    'Bangkit & Berani',
    'bangkit dan berani',
    0.780,
    'confirmed',
    'a0000000-0000-4000-8000-000000000812',
    '{"icon":"local_fire_department"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000823',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'target_reader',
    'Serial HP',
    'hp_serial',
    0.720,
    'confirmed',
    'a0000000-0000-4000-8000-000000000812',
    '{"icon":"smartphone"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000824',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000801',
    'secret_candidate',
    'Menganalisis...',
    '',
    NULL,
    'detected',
    NULL,
    '{"icon":"psychology_alt","pending":true}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- story_concepts (3 options from mockConcepts — concept 003 selected = project title)
-- -----------------------------------------------------------------------------
INSERT INTO public.story_concepts (
  id,
  project_id,
  title,
  short_pitch,
  reader_promise,
  core_conflict,
  genre,
  tone,
  target_reader,
  status,
  source,
  score,
  payload
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000831',
    'a0000000-0000-4000-8000-000000000101',
    'Luka yang Dibayar Mahal',
    'Seorang istri yang bertahun-tahun menahan diri akhirnya menghadapi kebenaran tentang keluarga suaminya — setiap luka punya harganya, dan dia tidak lagi mau diam.',
    'Perjalanan realistis seorang perempuan yang perlahan menemukan suara dan harga dirinya — tanpa keajaiban instan.',
    'Memilih antara mempertahankan rumah tangga demi anak-anak atau menuntut keadilan yang bisa menghancurkan segalanya.',
    'Drama Rumah Tangga',
    'Emosional',
    'hp_serial',
    'proposed',
    'stub',
    78.50,
    '{"mock_id":"concept-001","badgeLabel":"Drama Rumah Tangga / Emosional","badgeIcon":"favorite","decorativeAccent":"primary-soft"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000832',
    'a0000000-0000-4000-8000-000000000101',
    'Setelah Aku Pergi',
    'Dia pergi membawa hati yang remuk. Bertahun-tahun kemudian, keputusan itu kembali menghantui semua orang yang pernah meremehkannya.',
    'Momen baper dan penyesalan yang menyentuh; pembaca ingin tahu apakah ada ruang untuk pengampunan atau kebenaran yang lebih pahit.',
    'Mantan istri yang bangkit harus berhadapan lagi dengan keluarga yang dulu merendahkannya — tanpa kehilangan kedamaian yang sudah dibangunnya.',
    'Drama Keluarga',
    'Penyesalan',
    'hp_serial',
    'proposed',
    'stub',
    81.00,
    '{"mock_id":"concept-002","badgeLabel":"Drama Keluarga / Penyesalan","badgeIcon":"auto_awesome","featured":true,"decorativeAccent":"secondary-container"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000833',
    'a0000000-0000-4000-8000-000000000101',
    'Istri yang Mereka Buang',
    'Diremehkan, dianggap lemah, lalu dibuang begitu saja — tapi dia bangkit dengan rencana yang tenang, mematikan, dan memuaskan.',
    'Kemenangan kecil di tiap bab dan ending yang menggoda — pembaca ingin unlock bab berikutnya untuk melihat kejutan berikutnya.',
    'Menjalankan pembalasan elegan tanpa kehilangan moral sebagai ibu dan perempuan yang ingin dihormati.',
    'Drama Misteri',
    'Balas Dendam / Satisfying',
    'hp_serial',
    'selected',
    'stub',
    88.00,
    '{"mock_id":"concept-003","badgeLabel":"Balas Dendam / Satisfying","badgeIcon":"local_fire_department","decorativeAccent":"success-soft"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  short_pitch = EXCLUDED.short_pitch,
  status = EXCLUDED.status,
  payload = EXCLUDED.payload,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- projects — Sprint 3 workflow pointer (selected concept aligns with demo title)
-- -----------------------------------------------------------------------------
UPDATE public.projects
SET
  selected_concept_id = 'a0000000-0000-4000-8000-000000000833',
  workflow_phase = 'foundation',
  updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000101';