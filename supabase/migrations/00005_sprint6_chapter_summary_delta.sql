-- =============================================================================
-- VibeNovel Sprint 6 — Chapter summary & delta data model (Task 6.1)
-- Additive only: chapter_summaries, chapter_deltas, chapter_summary_items,
--   chapter_summary_proposals
-- Extends ai_proposal_type / ai_proposal_source enums
-- Enums align @vibenovel/shared | RLS owner-only via is_project_owner
-- NOT canon: summaries/deltas/items are review artifacts; proposals queue only
-- No triggers writing to facts/characters/open_loops/reveals
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend ai_proposal_type (Sprint 6 — additive)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_type' AND e.enumlabel = 'open_loop_update'
  ) THEN
    ALTER TYPE public.ai_proposal_type ADD VALUE 'open_loop_update';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_type' AND e.enumlabel = 'reveal_status_update'
  ) THEN
    ALTER TYPE public.ai_proposal_type ADD VALUE 'reveal_status_update';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_type' AND e.enumlabel = 'character_update'
  ) THEN
    ALTER TYPE public.ai_proposal_type ADD VALUE 'character_update';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_type' AND e.enumlabel = 'relationship_update'
  ) THEN
    ALTER TYPE public.ai_proposal_type ADD VALUE 'relationship_update';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Extend ai_proposal_source (Sprint 6 — additive)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_source' AND e.enumlabel = 'summary_stub'
  ) THEN
    ALTER TYPE public.ai_proposal_source ADD VALUE 'summary_stub';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_source' AND e.enumlabel = 'chapter_delta_stub'
  ) THEN
    ALTER TYPE public.ai_proposal_source ADD VALUE 'chapter_delta_stub';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 6 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.chapter_summary_status AS ENUM (
  'draft',
  'generated',
  'reviewing',
  'approved',
  'superseded'
);

CREATE TYPE public.chapter_delta_status AS ENUM (
  'generated',
  'reviewing',
  'approved',
  'superseded'
);

CREATE TYPE public.chapter_summary_item_type AS ENUM (
  'synopsis',
  'mini_victory',
  'character_change',
  'relationship_change',
  'new_fact_candidate',
  'open_loop_opened',
  'open_loop_paid_off',
  'reveal_candidate',
  'emotional_outcome',
  'ending_hook',
  'continuity_note',
  'safety_flag'
);

CREATE TYPE public.chapter_summary_item_severity AS ENUM (
  'info',
  'warning',
  'high_risk'
);

CREATE TYPE public.chapter_summary_proposal_status AS ENUM (
  'linked',
  'accepted',
  'rejected',
  'superseded'
);

-- -----------------------------------------------------------------------------
-- chapter_summaries (review artifact — NOT canon)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  writing_session_id uuid REFERENCES public.writing_sessions (id) ON DELETE SET NULL,
  current_prose_version_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status public.chapter_summary_status NOT NULL DEFAULT 'draft',
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  title text NOT NULL,
  synopsis text NOT NULL DEFAULT '',
  mini_victory text,
  emotional_outcome text,
  ending_hook text,
  word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  summary_version integer NOT NULL DEFAULT 1 CHECK (summary_version > 0),
  is_current boolean NOT NULL DEFAULT true,
  safety_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_summaries_outline_version_unique UNIQUE (chapter_outline_id, summary_version)
);

CREATE INDEX chapter_summaries_project_id_idx ON public.chapter_summaries (project_id);
CREATE INDEX chapter_summaries_chapter_outline_id_idx ON public.chapter_summaries (chapter_outline_id);
CREATE INDEX chapter_summaries_status_idx ON public.chapter_summaries (status);
CREATE INDEX chapter_summaries_writing_session_id_idx ON public.chapter_summaries (writing_session_id);

CREATE UNIQUE INDEX chapter_summaries_one_current_per_chapter_idx
  ON public.chapter_summaries (chapter_outline_id)
  WHERE is_current = true;

CREATE TRIGGER chapter_summaries_set_updated_at
  BEFORE UPDATE ON public.chapter_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_deltas (structured delta — NOT canon; 1:1 with summary)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_summary_id uuid NOT NULL REFERENCES public.chapter_summaries (id) ON DELETE CASCADE,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  status public.chapter_delta_status NOT NULL DEFAULT 'generated',
  delta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  safety_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  extractor_version text NOT NULL DEFAULT 'chapter_delta_v1_stub',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_deltas_summary_unique UNIQUE (chapter_summary_id)
);

CREATE INDEX chapter_deltas_project_id_idx ON public.chapter_deltas (project_id);
CREATE INDEX chapter_deltas_chapter_outline_id_idx ON public.chapter_deltas (chapter_outline_id);
CREATE INDEX chapter_deltas_status_idx ON public.chapter_deltas (status);

CREATE TRIGGER chapter_deltas_set_updated_at
  BEFORE UPDATE ON public.chapter_deltas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_summary_items (normalized review hints — NOT canon)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_summary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_summary_id uuid NOT NULL REFERENCES public.chapter_summaries (id) ON DELETE CASCADE,
  item_type public.chapter_summary_item_type NOT NULL,
  severity public.chapter_summary_item_severity NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  related_character_id uuid REFERENCES public.characters (id) ON DELETE SET NULL,
  related_fact_id uuid REFERENCES public.facts (id) ON DELETE SET NULL,
  related_open_loop_id uuid REFERENCES public.open_loops (id) ON DELETE SET NULL,
  related_reveal_id uuid REFERENCES public.planned_reveals (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chapter_summary_items_project_id_idx ON public.chapter_summary_items (project_id);
CREATE INDEX chapter_summary_items_chapter_summary_id_idx ON public.chapter_summary_items (chapter_summary_id);
CREATE INDEX chapter_summary_items_item_type_idx ON public.chapter_summary_items (item_type);

CREATE TRIGGER chapter_summary_items_set_updated_at
  BEFORE UPDATE ON public.chapter_summary_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_summary_proposals (junction summary ↔ ai_proposals)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_summary_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_summary_id uuid NOT NULL REFERENCES public.chapter_summaries (id) ON DELETE CASCADE,
  ai_proposal_id uuid NOT NULL REFERENCES public.ai_proposals (id) ON DELETE CASCADE,
  status public.chapter_summary_proposal_status NOT NULL DEFAULT 'linked',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_summary_proposals_unique UNIQUE (chapter_summary_id, ai_proposal_id)
);

CREATE INDEX chapter_summary_proposals_project_id_idx ON public.chapter_summary_proposals (project_id);
CREATE INDEX chapter_summary_proposals_chapter_summary_id_idx ON public.chapter_summary_proposals (chapter_summary_id);
CREATE INDEX chapter_summary_proposals_ai_proposal_id_idx ON public.chapter_summary_proposals (ai_proposal_id);
CREATE INDEX chapter_summary_proposals_status_idx ON public.chapter_summary_proposals (status);

CREATE TRIGGER chapter_summary_proposals_set_updated_at
  BEFORE UPDATE ON public.chapter_summary_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.chapter_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_summary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_summary_proposals ENABLE ROW LEVEL SECURITY;

-- chapter_summaries
CREATE POLICY chapter_summaries_select_owner ON public.chapter_summaries
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_summaries_insert_owner ON public.chapter_summaries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_summaries_update_owner ON public.chapter_summaries
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_summaries_delete_owner ON public.chapter_summaries
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_deltas
CREATE POLICY chapter_deltas_select_owner ON public.chapter_deltas
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_deltas_insert_owner ON public.chapter_deltas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_deltas_update_owner ON public.chapter_deltas
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_deltas_delete_owner ON public.chapter_deltas
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_summary_items
CREATE POLICY chapter_summary_items_select_owner ON public.chapter_summary_items
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_summary_items_insert_owner ON public.chapter_summary_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_summary_items_update_owner ON public.chapter_summary_items
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_summary_items_delete_owner ON public.chapter_summary_items
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_summary_proposals
CREATE POLICY chapter_summary_proposals_select_owner ON public.chapter_summary_proposals
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_summary_proposals_insert_owner ON public.chapter_summary_proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_summary_proposals_update_owner ON public.chapter_summary_proposals
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_summary_proposals_delete_owner ON public.chapter_summary_proposals
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_deltas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_summary_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_summary_proposals TO authenticated;

GRANT SELECT ON public.chapter_summaries TO anon;
GRANT SELECT ON public.chapter_deltas TO anon;
GRANT SELECT ON public.chapter_summary_items TO anon;
GRANT SELECT ON public.chapter_summary_proposals TO anon;

GRANT ALL ON public.chapter_summaries TO service_role;
GRANT ALL ON public.chapter_deltas TO service_role;
GRANT ALL ON public.chapter_summary_items TO service_role;
GRANT ALL ON public.chapter_summary_proposals TO service_role;

-- =============================================================================
-- Canon guardrails (Task 6.1 — schema only):
--   • chapter_summaries / chapter_deltas / chapter_summary_items are NOT canon
--   • current_prose_version_ids is snapshot reference — not source of canon
--   • chapter_summary_proposals links to ai_proposals — promotion is explicit (Task 6.4)
--   • Summary approval does NOT auto-accept proposals — no triggers on approve
--   • No triggers writing to facts, characters, speech_rules, open_loops, reveals
--   • metadata / safety_flags / delta_json must not store secrets or model IDs
-- =============================================================================