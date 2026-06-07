-- =============================================================================
-- VibeNovel Sprint 3 — Intake & concept data model (Task 3.1)
-- Additive only: intake_sessions, intake_messages, detected_signals, story_concepts
-- Enums align @vibenovel/shared | RLS owner-only via is_project_owner
-- NOT canon: concepts/signals/messages do not write to facts
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 3 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.workflow_phase AS ENUM (
  'intake',
  'concepts',
  'foundation',
  'foundation_locked'
);

CREATE TYPE public.intake_session_status AS ENUM (
  'active',
  'completed',
  'abandoned'
);

CREATE TYPE public.intake_phase AS ENUM (
  'idea_collection',
  'signal_detection',
  'concept_generation',
  'foundation_preparation'
);

CREATE TYPE public.intake_message_role AS ENUM (
  'user',
  'agent',
  'system'
);

CREATE TYPE public.detected_signal_type AS ENUM (
  'genre',
  'target_reader',
  'protagonist',
  'antagonist',
  'core_conflict',
  'reader_promise',
  'tone',
  'secret_candidate',
  'relationship_dynamic',
  'setting',
  'theme',
  'style_preference'
);

CREATE TYPE public.detected_signal_status AS ENUM (
  'detected',
  'confirmed',
  'dismissed'
);

CREATE TYPE public.story_concept_status AS ENUM (
  'proposed',
  'selected',
  'rejected'
);

CREATE TYPE public.story_concept_source AS ENUM (
  'user',
  'system',
  'stub',
  'accepted_proposal'
);

-- -----------------------------------------------------------------------------
-- intake_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE public.intake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  status public.intake_session_status NOT NULL DEFAULT 'active',
  phase public.intake_phase NOT NULL DEFAULT 'idea_collection',
  progress_percent integer NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intake_sessions_project_id_idx ON public.intake_sessions (project_id);

CREATE TRIGGER intake_sessions_set_updated_at
  BEFORE UPDATE ON public.intake_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- intake_messages (append-only chat; no updated_at)
-- -----------------------------------------------------------------------------
CREATE TABLE public.intake_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.intake_sessions (id) ON DELETE CASCADE,
  role public.intake_message_role NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intake_messages_session_id_idx ON public.intake_messages (session_id);
CREATE INDEX intake_messages_project_id_idx ON public.intake_messages (project_id);

-- -----------------------------------------------------------------------------
-- detected_signals (not canon)
-- -----------------------------------------------------------------------------
CREATE TABLE public.detected_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.intake_sessions (id) ON DELETE CASCADE,
  type public.detected_signal_type NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  confidence numeric(4, 3)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status public.detected_signal_status NOT NULL DEFAULT 'detected',
  source_message_id uuid REFERENCES public.intake_messages (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX detected_signals_project_id_idx ON public.detected_signals (project_id);
CREATE INDEX detected_signals_session_id_idx ON public.detected_signals (session_id);

CREATE TRIGGER detected_signals_set_updated_at
  BEFORE UPDATE ON public.detected_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- story_concepts (not canon)
-- -----------------------------------------------------------------------------
CREATE TABLE public.story_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  title text NOT NULL,
  short_pitch text NOT NULL,
  reader_promise text,
  core_conflict text,
  genre text,
  tone text,
  target_reader text,
  status public.story_concept_status NOT NULL DEFAULT 'proposed',
  source public.story_concept_source NOT NULL DEFAULT 'stub',
  score numeric(5, 2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX story_concepts_project_id_idx ON public.story_concepts (project_id);

CREATE UNIQUE INDEX story_concepts_one_selected_per_project_idx
  ON public.story_concepts (project_id)
  WHERE status = 'selected';

CREATE TRIGGER story_concepts_set_updated_at
  BEFORE UPDATE ON public.story_concepts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- projects — workflow pointer (FK after story_concepts exists)
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN workflow_phase public.workflow_phase NOT NULL DEFAULT 'intake';

ALTER TABLE public.projects
  ADD COLUMN selected_concept_id uuid REFERENCES public.story_concepts (id) ON DELETE SET NULL;

CREATE INDEX projects_workflow_phase_idx ON public.projects (workflow_phase);
CREATE INDEX projects_selected_concept_id_idx ON public.projects (selected_concept_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_concepts ENABLE ROW LEVEL SECURITY;

-- intake_sessions
CREATE POLICY intake_sessions_select_owner ON public.intake_sessions
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY intake_sessions_insert_owner ON public.intake_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY intake_sessions_update_owner ON public.intake_sessions
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY intake_sessions_delete_owner ON public.intake_sessions
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- intake_messages
CREATE POLICY intake_messages_select_owner ON public.intake_messages
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY intake_messages_insert_owner ON public.intake_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY intake_messages_update_owner ON public.intake_messages
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY intake_messages_delete_owner ON public.intake_messages
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- detected_signals
CREATE POLICY detected_signals_select_owner ON public.detected_signals
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY detected_signals_insert_owner ON public.detected_signals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY detected_signals_update_owner ON public.detected_signals
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY detected_signals_delete_owner ON public.detected_signals
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- story_concepts (not canon — no promotion to facts from this table)
CREATE POLICY story_concepts_select_owner ON public.story_concepts
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY story_concepts_insert_owner ON public.story_concepts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY story_concepts_update_owner ON public.story_concepts
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY story_concepts_delete_owner ON public.story_concepts
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants (new tables)
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detected_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_concepts TO authenticated;

GRANT SELECT ON public.intake_sessions TO anon;
GRANT SELECT ON public.intake_messages TO anon;
GRANT SELECT ON public.detected_signals TO anon;
GRANT SELECT ON public.story_concepts TO anon;

GRANT ALL ON public.intake_sessions TO service_role;
GRANT ALL ON public.intake_messages TO service_role;
GRANT ALL ON public.detected_signals TO service_role;
GRANT ALL ON public.story_concepts TO service_role;

-- =============================================================================
-- Canon guardrails (Task 3.1 — schema only):
--   • story_concepts / detected_signals / intake_messages are NOT canon tables
--   • projects.selected_concept_id is a UX pointer only
--   • facts still require user / system / accepted_proposal via API promotion
--   • audit_action enum extension deferred to Task 3.2/3.3
-- =============================================================================