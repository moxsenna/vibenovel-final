-- =============================================================================
-- Narraza Sprint 16 - Continuity Engine I: Character State + Knowledge
-- Additive only: character_states + character_knowledge.
-- Guardrail: these rows describe perspective/continuity state and do not write
-- directly to facts. Canon fact changes still go through chapter delta proposals.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_type' AND e.enumlabel = 'character_state_update'
  ) THEN
    ALTER TYPE public.ai_proposal_type ADD VALUE 'character_state_update';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_proposal_type' AND e.enumlabel = 'character_knowledge_update'
  ) THEN
    ALTER TYPE public.ai_proposal_type ADD VALUE 'character_knowledge_update';
  END IF;
END $$;

CREATE TYPE public.character_knowledge_status AS ENUM (
  'unknown',
  'suspects',
  'partially_knows',
  'knows',
  'misbelieves'
);

-- -----------------------------------------------------------------------------
-- character_states (snapshot per character/chapter)
-- -----------------------------------------------------------------------------
CREATE TABLE public.character_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  emotional_state text,
  physical_state text,
  current_goal text,
  location_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_states_character_chapter_unique UNIQUE (character_id, chapter_number)
);

CREATE INDEX character_states_project_id_idx ON public.character_states (project_id);
CREATE INDEX character_states_character_id_idx ON public.character_states (character_id);
CREATE INDEX character_states_project_character_chapter_idx
  ON public.character_states (project_id, character_id, chapter_number DESC);

CREATE TRIGGER character_states_set_updated_at
  BEFORE UPDATE ON public.character_states
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- character_knowledge (who knows/suspects/misbelieves which confirmed fact)
-- -----------------------------------------------------------------------------
CREATE TABLE public.character_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  fact_id uuid NOT NULL REFERENCES public.facts (id) ON DELETE CASCADE,
  knowledge_status public.character_knowledge_status NOT NULL DEFAULT 'unknown',
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  learned_at_chapter integer CHECK (learned_at_chapter IS NULL OR learned_at_chapter > 0),
  learned_from text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_knowledge_character_fact_unique UNIQUE (character_id, fact_id)
);

CREATE INDEX character_knowledge_project_id_idx ON public.character_knowledge (project_id);
CREATE INDEX character_knowledge_character_id_idx ON public.character_knowledge (character_id);
CREATE INDEX character_knowledge_fact_id_idx ON public.character_knowledge (fact_id);
CREATE INDEX character_knowledge_project_fact_idx
  ON public.character_knowledge (project_id, fact_id);
CREATE INDEX character_knowledge_project_character_status_idx
  ON public.character_knowledge (project_id, character_id, knowledge_status);

CREATE TRIGGER character_knowledge_set_updated_at
  BEFORE UPDATE ON public.character_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (owner-only via is_project_owner - same project boundary as canon tables)
-- -----------------------------------------------------------------------------
ALTER TABLE public.character_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY character_states_select_owner ON public.character_states
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY character_states_insert_owner ON public.character_states
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY character_states_update_owner ON public.character_states
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY character_states_delete_owner ON public.character_states
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY character_knowledge_select_owner ON public.character_knowledge
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY character_knowledge_insert_owner ON public.character_knowledge
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY character_knowledge_update_owner ON public.character_knowledge
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY character_knowledge_delete_owner ON public.character_knowledge
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_knowledge TO authenticated;

GRANT SELECT ON public.character_states TO anon;
GRANT SELECT ON public.character_knowledge TO anon;

GRANT ALL ON public.character_states TO service_role;
GRANT ALL ON public.character_knowledge TO service_role;

-- =============================================================================
-- Canon guardrails:
--   * character_states and character_knowledge are continuity/perspective data.
--   * No trigger writes to facts, characters, planned_reveals, or open_loops.
--   * AI-discovered changes must first become chapter delta proposals, then be
--     accepted by a reviewer before services update continuity rows.
-- =============================================================================
