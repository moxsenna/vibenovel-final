-- =============================================================================
-- Narraza Sprint 17 — Continuity Engine II: Timeline + Mini-Arc planning
-- Additive only: mini_arcs, timeline_events + chapter_outlines.mini_arc_id (nullable)
-- Enums align @vibenovel/shared (Sprint 17 section) | RLS owner-only
-- NOT canon: timeline_events are past/current continuity facts derived at chapter
--   close; they do NOT mutate `facts` and carry no future (planner) truth.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE public.timeline_event_source AS ENUM (
  'chapter_close',
  'user'
);

-- -----------------------------------------------------------------------------
-- mini_arcs (Season → MiniArc → Chapter structure — planner artifact, NOT canon)
-- -----------------------------------------------------------------------------
CREATE TABLE public.mini_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  outline_plan_id uuid NOT NULL REFERENCES public.outline_plans (id) ON DELETE CASCADE,
  arc_number integer NOT NULL CHECK (arc_number > 0),
  title text NOT NULL,
  premise text NOT NULL DEFAULT '',
  start_chapter integer NOT NULL CHECK (start_chapter > 0),
  end_chapter integer NOT NULL CHECK (end_chapter >= start_chapter),
  payoff text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mini_arcs_plan_arc_unique UNIQUE (outline_plan_id, arc_number)
);

CREATE INDEX mini_arcs_project_id_idx ON public.mini_arcs (project_id);
CREATE INDEX mini_arcs_outline_plan_id_idx ON public.mini_arcs (outline_plan_id);

CREATE TRIGGER mini_arcs_set_updated_at
  BEFORE UPDATE ON public.mini_arcs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- chapter_outlines.mini_arc_id (additive, nullable, backward-compatible)
-- ON DELETE SET NULL so deleting an arc never orphans a chapter outline.
-- -----------------------------------------------------------------------------
ALTER TABLE public.chapter_outlines
  ADD COLUMN mini_arc_id uuid REFERENCES public.mini_arcs (id) ON DELETE SET NULL;

CREATE INDEX chapter_outlines_mini_arc_id_idx ON public.chapter_outlines (mini_arc_id);

-- -----------------------------------------------------------------------------
-- timeline_events (continuity timeline — past/current only; NOT canon)
-- Created at chapter close from approved summary; relative_order = chapter_number
-- for cross-chapter ordering. involved_character_ids references characters but is
-- stored as uuid[] (no per-element FK) to keep close-flow inserts cheap + idempotent.
-- -----------------------------------------------------------------------------
CREATE TABLE public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_outline_id uuid REFERENCES public.chapter_outlines (id) ON DELETE SET NULL,
  chapter_summary_id uuid REFERENCES public.chapter_summaries (id) ON DELETE SET NULL,
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  relative_order integer NOT NULL DEFAULT 0,
  event text NOT NULL,
  involved_character_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  location_id uuid REFERENCES public.characters (id) ON DELETE SET NULL,
  consequences text[] NOT NULL DEFAULT '{}'::text[],
  source public.timeline_event_source NOT NULL DEFAULT 'chapter_close',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX timeline_events_project_id_idx ON public.timeline_events (project_id);
CREATE INDEX timeline_events_chapter_number_idx ON public.timeline_events (project_id, chapter_number);
CREATE INDEX timeline_events_chapter_outline_id_idx ON public.timeline_events (chapter_outline_id);
CREATE INDEX timeline_events_order_idx ON public.timeline_events (project_id, relative_order);

-- One chapter_close event per (project, chapter) keeps materialization idempotent.
CREATE UNIQUE INDEX timeline_events_one_close_per_chapter_idx
  ON public.timeline_events (project_id, chapter_number)
  WHERE source = 'chapter_close';

CREATE TRIGGER timeline_events_set_updated_at
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (owner-only via is_project_owner — same pattern as Sprint 4–6 tables)
-- -----------------------------------------------------------------------------
ALTER TABLE public.mini_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mini_arcs_select_owner ON public.mini_arcs
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY mini_arcs_insert_owner ON public.mini_arcs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY mini_arcs_update_owner ON public.mini_arcs
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY mini_arcs_delete_owner ON public.mini_arcs
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY timeline_events_select_owner ON public.timeline_events
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY timeline_events_insert_owner ON public.timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY timeline_events_update_owner ON public.timeline_events
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY timeline_events_delete_owner ON public.timeline_events
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mini_arcs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO authenticated;

GRANT SELECT ON public.mini_arcs TO anon;
GRANT SELECT ON public.timeline_events TO anon;

GRANT ALL ON public.mini_arcs TO service_role;
GRANT ALL ON public.timeline_events TO service_role;

-- =============================================================================
-- Canon guardrails (Sprint 17 — schema only):
--   • mini_arcs / timeline_events are planning/continuity artifacts — NOT canon
--   • No triggers writing to facts / characters / open_loops / planned_reveals
--   • timeline_events hold past/current chapter facts only; future planner truth
--     stays in planned_reveals.planning_truth and never reaches the writer packet
--   • chapter_outlines.mini_arc_id is presentational grouping only
-- =============================================================================
