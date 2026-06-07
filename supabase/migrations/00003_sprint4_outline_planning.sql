-- =============================================================================
-- VibeNovel Sprint 4 — Outline planning data model (Task 4.1)
-- Additive only: outline_plans, chapter_outlines, open_loops, planned_reveals
-- Enums align @vibenovel/shared | RLS owner-only via is_project_owner
-- NOT prose: outline rows are planner data; planned_reveals.planning_truth is planner-only
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend workflow_phase (Sprint 4)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'workflow_phase'
      AND e.enumlabel = 'outline'
  ) THEN
    ALTER TYPE public.workflow_phase ADD VALUE 'outline';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'workflow_phase'
      AND e.enumlabel = 'outline_locked'
  ) THEN
    ALTER TYPE public.workflow_phase ADD VALUE 'outline_locked';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 4 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.outline_plan_status AS ENUM (
  'draft',
  'generated',
  'reviewing',
  'locked'
);

CREATE TYPE public.chapter_outline_status AS ENUM (
  'planned',
  'reviewing',
  'approved',
  'locked'
);

CREATE TYPE public.chapter_function AS ENUM (
  'setup',
  'conflict',
  'escalation',
  'emotional_turn',
  'mini_victory',
  'reveal',
  'cliffhanger',
  'payoff',
  'transition'
);

CREATE TYPE public.chapter_emotion AS ENUM (
  'hurt',
  'tense',
  'angry',
  'hopeful',
  'satisfying',
  'curious',
  'anxious',
  'triumphant'
);

CREATE TYPE public.open_loop_status AS ENUM (
  'opened',
  'developed',
  'paid_off',
  'dropped'
);

CREATE TYPE public.planned_reveal_status AS ENUM (
  'planned',
  'armed',
  'revealed',
  'delayed',
  'cancelled'
);

CREATE TYPE public.reveal_risk_level AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE public.retention_marker_type AS ENUM (
  'hook',
  'mini_victory',
  'open_loop',
  'cliffhanger',
  'emotional_payoff',
  'reversal',
  'secret_hint'
);

-- -----------------------------------------------------------------------------
-- outline_plans (one per project — MVP)
-- -----------------------------------------------------------------------------
CREATE TABLE public.outline_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  status public.outline_plan_status NOT NULL DEFAULT 'draft',
  season_label text NOT NULL DEFAULT 'Season 1',
  arc_summary text,
  retention_summary text,
  target_chapter_count integer NOT NULL DEFAULT 10
    CHECK (target_chapter_count >= 1 AND target_chapter_count <= 200),
  planning_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outline_plans_project_id_unique UNIQUE (project_id)
);

CREATE INDEX outline_plans_project_id_idx ON public.outline_plans (project_id);
CREATE INDEX outline_plans_status_idx ON public.outline_plans (status);

CREATE TRIGGER outline_plans_set_updated_at
  BEFORE UPDATE ON public.outline_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_outlines (outline-only — NOT prose chapters)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chapter_outlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  outline_plan_id uuid NOT NULL REFERENCES public.outline_plans (id) ON DELETE CASCADE,
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  title text NOT NULL,
  summary text NOT NULL,
  purpose text,
  chapter_function public.chapter_function NOT NULL DEFAULT 'conflict',
  emotional_direction public.chapter_emotion,
  hook text,
  ending_hook text,
  mini_victory text,
  pov_character_id uuid REFERENCES public.characters (id) ON DELETE SET NULL,
  status public.chapter_outline_status NOT NULL DEFAULT 'planned',
  markers jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_outlines_plan_chapter_unique UNIQUE (outline_plan_id, chapter_number)
);

CREATE INDEX chapter_outlines_project_id_idx ON public.chapter_outlines (project_id);
CREATE INDEX chapter_outlines_outline_plan_id_idx ON public.chapter_outlines (outline_plan_id);
CREATE INDEX chapter_outlines_chapter_number_idx ON public.chapter_outlines (outline_plan_id, chapter_number);

CREATE TRIGGER chapter_outlines_set_updated_at
  BEFORE UPDATE ON public.chapter_outlines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- open_loops (tracked questions — status does NOT mutate facts)
-- -----------------------------------------------------------------------------
CREATE TABLE public.open_loops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  outline_plan_id uuid NOT NULL REFERENCES public.outline_plans (id) ON DELETE CASCADE,
  opened_in_chapter_outline_id uuid REFERENCES public.chapter_outlines (id) ON DELETE SET NULL,
  payoff_chapter_outline_id uuid REFERENCES public.chapter_outlines (id) ON DELETE SET NULL,
  question text NOT NULL,
  reader_facing_hint text,
  status public.open_loop_status NOT NULL DEFAULT 'opened',
  importance public.fact_importance NOT NULL DEFAULT 'major',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX open_loops_project_id_idx ON public.open_loops (project_id);
CREATE INDEX open_loops_outline_plan_id_idx ON public.open_loops (outline_plan_id);
CREATE INDEX open_loops_status_idx ON public.open_loops (status);

CREATE TRIGGER open_loops_set_updated_at
  BEFORE UPDATE ON public.open_loops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- planned_reveals (planner-only truth — NOT raw writer context)
-- -----------------------------------------------------------------------------
CREATE TABLE public.planned_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  outline_plan_id uuid NOT NULL REFERENCES public.outline_plans (id) ON DELETE CASCADE,
  planned_chapter_outline_id uuid REFERENCES public.chapter_outlines (id) ON DELETE SET NULL,
  related_fact_id uuid REFERENCES public.facts (id) ON DELETE SET NULL,
  related_proposal_id uuid REFERENCES public.ai_proposals (id) ON DELETE SET NULL,
  title text NOT NULL,
  planning_truth text NOT NULL,
  reader_facing_hint text,
  forbidden_before_chapter integer
    CHECK (forbidden_before_chapter IS NULL OR forbidden_before_chapter > 0),
  status public.planned_reveal_status NOT NULL DEFAULT 'planned',
  risk_level public.reveal_risk_level NOT NULL DEFAULT 'medium',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX planned_reveals_project_id_idx ON public.planned_reveals (project_id);
CREATE INDEX planned_reveals_outline_plan_id_idx ON public.planned_reveals (outline_plan_id);
CREATE INDEX planned_reveals_status_idx ON public.planned_reveals (status);

CREATE TRIGGER planned_reveals_set_updated_at
  BEFORE UPDATE ON public.planned_reveals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.outline_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_reveals ENABLE ROW LEVEL SECURITY;

-- outline_plans
CREATE POLICY outline_plans_select_owner ON public.outline_plans
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY outline_plans_insert_owner ON public.outline_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY outline_plans_update_owner ON public.outline_plans
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY outline_plans_delete_owner ON public.outline_plans
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- chapter_outlines
CREATE POLICY chapter_outlines_select_owner ON public.chapter_outlines
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY chapter_outlines_insert_owner ON public.chapter_outlines
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_outlines_update_owner ON public.chapter_outlines
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY chapter_outlines_delete_owner ON public.chapter_outlines
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- open_loops
CREATE POLICY open_loops_select_owner ON public.open_loops
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY open_loops_insert_owner ON public.open_loops
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY open_loops_update_owner ON public.open_loops
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY open_loops_delete_owner ON public.open_loops
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- planned_reveals
CREATE POLICY planned_reveals_select_owner ON public.planned_reveals
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY planned_reveals_insert_owner ON public.planned_reveals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY planned_reveals_update_owner ON public.planned_reveals
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY planned_reveals_delete_owner ON public.planned_reveals
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outline_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_outlines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_loops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_reveals TO authenticated;

GRANT SELECT ON public.outline_plans TO anon;
GRANT SELECT ON public.chapter_outlines TO anon;
GRANT SELECT ON public.open_loops TO anon;
GRANT SELECT ON public.planned_reveals TO anon;

GRANT ALL ON public.outline_plans TO service_role;
GRANT ALL ON public.chapter_outlines TO service_role;
GRANT ALL ON public.open_loops TO service_role;
GRANT ALL ON public.planned_reveals TO service_role;

-- =============================================================================
-- Canon guardrails (Task 4.1 — schema only):
--   • outline_plans / chapter_outlines are NOT prose — no chapter bodies
--   • planned_reveals.planning_truth is planner-only (Reveal Gate in Sprint 5+)
--   • open_loops status changes do NOT write to facts
--   • related_fact_id links existing canon only — no auto-promotion from reveals
--   • Writer context must be slice-only per chapter (packages/shared docs)
-- =============================================================================