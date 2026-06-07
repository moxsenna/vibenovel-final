-- =============================================================================
-- VibeNovel Sprint 5 — Write Room data model (Task 5.1)
-- Additive only: writing_sessions, chapter_writing_states, chapter_beats,
--   chapter_prose_versions, context_packet_logs
-- Enums align @vibenovel/shared | RLS owner-only via is_project_owner
-- NOT canon: draft prose and context packets must not mutate facts
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend workflow_phase (Sprint 5)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'workflow_phase'
      AND e.enumlabel = 'writing'
  ) THEN
    ALTER TYPE public.workflow_phase ADD VALUE 'writing';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 5 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.writing_session_status AS ENUM (
  'active',
  'paused',
  'ready_for_summary',
  'completed',
  'abandoned'
);

CREATE TYPE public.chapter_writing_status AS ENUM (
  'not_started',
  'drafting',
  'ready_for_summary',
  'summarized'
);

CREATE TYPE public.chapter_beat_status AS ENUM (
  'empty',
  'draft',
  'done'
);

CREATE TYPE public.chapter_prose_source AS ENUM (
  'user_edited',
  'stub_deterministic',
  'ai_generated'
);

-- -----------------------------------------------------------------------------
-- writing_sessions (one active per chapter outline — partial unique below)
-- active_beat_id FK added after chapter_beats exists
-- -----------------------------------------------------------------------------
CREATE TABLE public.writing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  status public.writing_session_status NOT NULL DEFAULT 'active',
  active_beat_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  ready_for_summary_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX writing_sessions_project_id_idx ON public.writing_sessions (project_id);
CREATE INDEX writing_sessions_chapter_outline_id_idx ON public.writing_sessions (chapter_outline_id);
CREATE INDEX writing_sessions_status_idx ON public.writing_sessions (status);

CREATE UNIQUE INDEX writing_sessions_one_active_per_chapter_idx
  ON public.writing_sessions (project_id, chapter_outline_id)
  WHERE status = 'active';

CREATE TRIGGER writing_sessions_set_updated_at
  BEFORE UPDATE ON public.writing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_writing_states (prose metadata — separate from chapter_outlines)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_writing_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  writing_session_id uuid REFERENCES public.writing_sessions (id) ON DELETE SET NULL,
  status public.chapter_writing_status NOT NULL DEFAULT 'not_started',
  word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  last_saved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_writing_states_chapter_outline_unique UNIQUE (chapter_outline_id)
);

CREATE INDEX chapter_writing_states_project_id_idx ON public.chapter_writing_states (project_id);
CREATE INDEX chapter_writing_states_status_idx ON public.chapter_writing_states (status);

CREATE TRIGGER chapter_writing_states_set_updated_at
  BEFORE UPDATE ON public.chapter_writing_states
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_beats (scene list per chapter — parity mockChapterDraft)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  writing_session_id uuid REFERENCES public.writing_sessions (id) ON DELETE SET NULL,
  beat_number integer NOT NULL CHECK (beat_number > 0),
  title text NOT NULL,
  summary text NOT NULL,
  direction text,
  status public.chapter_beat_status NOT NULL DEFAULT 'empty',
  emotional_shift text,
  must_include text[] NOT NULL DEFAULT '{}'::text[],
  must_not_include text[] NOT NULL DEFAULT '{}'::text[],
  word_target integer CHECK (word_target IS NULL OR word_target > 0),
  stop_condition text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_beats_outline_beat_unique UNIQUE (chapter_outline_id, beat_number)
);

CREATE INDEX chapter_beats_project_id_idx ON public.chapter_beats (project_id);
CREATE INDEX chapter_beats_chapter_outline_id_idx ON public.chapter_beats (chapter_outline_id);
CREATE INDEX chapter_beats_writing_session_id_idx ON public.chapter_beats (writing_session_id);

CREATE TRIGGER chapter_beats_set_updated_at
  BEFORE UPDATE ON public.chapter_beats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_prose_versions (draft storage — NOT canon)
-- context_packet_log_id FK added after context_packet_logs exists
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_prose_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_beat_id uuid NOT NULL REFERENCES public.chapter_beats (id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  prose_text text NOT NULL,
  word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  source public.chapter_prose_source NOT NULL DEFAULT 'user_edited',
  is_current boolean NOT NULL DEFAULT true,
  context_packet_log_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_prose_versions_beat_version_unique UNIQUE (chapter_beat_id, version_number)
);

CREATE INDEX chapter_prose_versions_project_id_idx ON public.chapter_prose_versions (project_id);
CREATE INDEX chapter_prose_versions_chapter_beat_id_idx ON public.chapter_prose_versions (chapter_beat_id);

CREATE UNIQUE INDEX chapter_prose_versions_one_current_per_beat_idx
  ON public.chapter_prose_versions (chapter_beat_id)
  WHERE is_current = true;

-- -----------------------------------------------------------------------------
-- context_packet_logs (backend-built safe context audit trail)
-- packet_json must be safe-only; DB cannot enforce no planningTruth — API responsibility
-- metadata on related tables must not store secrets, model IDs, or tokens
-- -----------------------------------------------------------------------------
CREATE TABLE public.context_packet_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  writing_session_id uuid REFERENCES public.writing_sessions (id) ON DELETE SET NULL,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  chapter_beat_id uuid REFERENCES public.chapter_beats (id) ON DELETE SET NULL,
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  packet_hash text NOT NULL,
  packet_json jsonb NOT NULL,
  builder_version text NOT NULL DEFAULT 'context_packet_v1_stub',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX context_packet_logs_project_id_idx ON public.context_packet_logs (project_id);
CREATE INDEX context_packet_logs_chapter_outline_id_idx ON public.context_packet_logs (chapter_outline_id);
CREATE INDEX context_packet_logs_writing_session_id_idx ON public.context_packet_logs (writing_session_id);
CREATE INDEX context_packet_logs_chapter_number_idx ON public.context_packet_logs (project_id, chapter_number);

-- -----------------------------------------------------------------------------
-- Deferred FKs (tables must exist first)
-- -----------------------------------------------------------------------------
ALTER TABLE public.writing_sessions
  ADD CONSTRAINT writing_sessions_active_beat_id_fkey
  FOREIGN KEY (active_beat_id) REFERENCES public.chapter_beats (id) ON DELETE SET NULL;

ALTER TABLE public.chapter_prose_versions
  ADD CONSTRAINT chapter_prose_versions_context_packet_log_id_fkey
  FOREIGN KEY (context_packet_log_id) REFERENCES public.context_packet_logs (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.writing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_writing_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_prose_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_packet_logs ENABLE ROW LEVEL SECURITY;

-- writing_sessions
CREATE POLICY writing_sessions_select_owner ON public.writing_sessions
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY writing_sessions_insert_owner ON public.writing_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY writing_sessions_update_owner ON public.writing_sessions
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY writing_sessions_delete_owner ON public.writing_sessions
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_writing_states
CREATE POLICY chapter_writing_states_select_owner ON public.chapter_writing_states
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_writing_states_insert_owner ON public.chapter_writing_states
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_writing_states_update_owner ON public.chapter_writing_states
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_writing_states_delete_owner ON public.chapter_writing_states
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_beats
CREATE POLICY chapter_beats_select_owner ON public.chapter_beats
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_beats_insert_owner ON public.chapter_beats
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_beats_update_owner ON public.chapter_beats
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_beats_delete_owner ON public.chapter_beats
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_prose_versions
CREATE POLICY chapter_prose_versions_select_owner ON public.chapter_prose_versions
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_prose_versions_insert_owner ON public.chapter_prose_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_prose_versions_update_owner ON public.chapter_prose_versions
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_prose_versions_delete_owner ON public.chapter_prose_versions
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- context_packet_logs (owner SELECT for MVP; web API later returns preview only)
CREATE POLICY context_packet_logs_select_owner ON public.context_packet_logs
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY context_packet_logs_insert_owner ON public.context_packet_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY context_packet_logs_update_owner ON public.context_packet_logs
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY context_packet_logs_delete_owner ON public.context_packet_logs
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_writing_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_beats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_prose_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.context_packet_logs TO authenticated;

GRANT SELECT ON public.writing_sessions TO anon;
GRANT SELECT ON public.chapter_writing_states TO anon;
GRANT SELECT ON public.chapter_beats TO anon;
GRANT SELECT ON public.chapter_prose_versions TO anon;
GRANT SELECT ON public.context_packet_logs TO anon;

GRANT ALL ON public.writing_sessions TO service_role;
GRANT ALL ON public.chapter_writing_states TO service_role;
GRANT ALL ON public.chapter_beats TO service_role;
GRANT ALL ON public.chapter_prose_versions TO service_role;
GRANT ALL ON public.context_packet_logs TO service_role;

-- =============================================================================
-- Canon guardrails (Task 5.1 — schema only):
--   • chapter_prose_versions is draft storage — NOT canon until Sprint 6 summary
--   • No triggers writing to facts/characters from prose tables
--   • context_packet_logs.packet_json must be safe packet only (no planningTruth)
--   • metadata jsonb must not store secrets, model IDs, tokens, or raw prompts
--   • chapter_outlines remain planning-only — writer does not mutate via these tables
--   • chapter_generation_attempts / validation_reports NOT created in Sprint 5.1
-- =============================================================================