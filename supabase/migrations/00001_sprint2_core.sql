-- =============================================================================
-- VibeNovel Sprint 2 — Core migration (Task 2.3)
-- 9 tables + audit_logs | enums align @vibenovel/shared | RLS per docs/28
-- NOT included: chapters, reveals, prose_versions, validation_reports, credit_ledger
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts)
-- -----------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('writer', 'admin');

CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'pro');

CREATE TYPE public.project_status AS ENUM ('draft', 'in_progress', 'published');

CREATE TYPE public.project_entry_path AS ENUM (
  'no_idea',
  'rough_idea',
  'has_draft',
  'has_outline',
  'repair_only'
);

CREATE TYPE public.writer_quality_mode AS ENUM ('hemat', 'seimbang', 'terbaik');

CREATE TYPE public.default_language AS ENUM ('id', 'en');

CREATE TYPE public.mobile_format_preference AS ENUM ('hp_kbm', 'desktop');

CREATE TYPE public.output_style_preference AS ENUM (
  'warm_emotional',
  'fast_paced',
  'poetic',
  'conversational',
  'custom'
);

CREATE TYPE public.target_length_plan AS ENUM (
  '30_50',
  '70_100',
  '120_150',
  '180_plus',
  'suggest'
);

CREATE TYPE public.foundation_status AS ENUM ('draft', 'in_review', 'locked');

CREATE TYPE public.foundation_readiness_level AS ENUM (
  'belum_siap',
  'bisa_lanjut',
  'siap_dikunci'
);

CREATE TYPE public.character_role AS ENUM (
  'protagonist',
  'antagonist',
  'supporting',
  'minor',
  'other'
);

CREATE TYPE public.character_status AS ENUM ('active', 'archived');

CREATE TYPE public.character_importance AS ENUM ('main', 'supporting', 'minor');

CREATE TYPE public.character_source AS ENUM ('user', 'system_seed', 'accepted_proposal');

CREATE TYPE public.fact_category AS ENUM (
  'identity',
  'relationship',
  'family',
  'event',
  'secret',
  'motive',
  'location',
  'item',
  'world_rule',
  'timeline',
  'status',
  'promise'
);

CREATE TYPE public.fact_canon_status AS ENUM ('confirmed', 'deprecated');

CREATE TYPE public.fact_source AS ENUM (
  'user',
  'system',
  'accepted_proposal',
  'imported_draft'
);

CREATE TYPE public.fact_importance AS ENUM ('minor', 'major', 'core');

CREATE TYPE public.speech_rule_status AS ENUM ('active', 'draft', 'deprecated');

CREATE TYPE public.speech_rule_source AS ENUM ('user', 'accepted_proposal');

CREATE TYPE public.ai_proposal_type AS ENUM (
  'character',
  'fact',
  'relationship_speech_rule',
  'secret',
  'reveal',
  'style',
  'foundation',
  'chapter_delta'
);

CREATE TYPE public.ai_proposal_status AS ENUM (
  'proposed',
  'accepted',
  'rejected',
  'merged'
);

CREATE TYPE public.ai_proposal_risk_level AS ENUM ('low', 'medium', 'high');

CREATE TYPE public.ai_proposal_source AS ENUM (
  'user_manual',
  'system_seed',
  'ai_chat',
  'ai_foundation',
  'ai_import'
);

CREATE TYPE public.credit_balance_source AS ENUM ('seed', 'admin_grant', 'ledger');

CREATE TYPE public.audit_action AS ENUM (
  'project_created',
  'project_updated',
  'settings_updated',
  'foundation_created',
  'foundation_updated',
  'foundation_locked',
  'character_created',
  'character_updated',
  'fact_created',
  'fact_updated',
  'fact_deprecated',
  'speech_rule_created',
  'speech_rule_updated',
  'ai_proposal_created',
  'ai_proposal_accepted',
  'ai_proposal_rejected',
  'ai_proposal_merged',
  'credit_balance_seeded'
);

CREATE TYPE public.audit_entity_type AS ENUM (
  'profile',
  'project',
  'project_settings',
  'story_foundation',
  'character',
  'fact',
  'relationship_speech_rule',
  'ai_proposal',
  'credit_balance'
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  default_language public.default_language NOT NULL DEFAULT 'id',
  plan_label text NOT NULL DEFAULT 'Free Plan',
  role public.user_role NOT NULL DEFAULT 'writer',
  subscription_plan public.subscription_plan NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Project',
  genre text,
  status public.project_status NOT NULL DEFAULT 'draft',
  current_chapter integer NOT NULL DEFAULT 0 CHECK (current_chapter >= 0),
  entry_path public.project_entry_path,
  is_active boolean NOT NULL DEFAULT false,
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_owner_id_idx ON public.projects (owner_id);
CREATE UNIQUE INDEX projects_one_active_per_owner_idx
  ON public.projects (owner_id)
  WHERE is_active = true;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.owner_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- project_settings (1:1 per project)
-- -----------------------------------------------------------------------------
CREATE TABLE public.project_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects (id) ON DELETE CASCADE,
  quality_tier public.writer_quality_mode NOT NULL DEFAULT 'seimbang',
  output_style_preference public.output_style_preference NOT NULL DEFAULT 'warm_emotional',
  default_format public.mobile_format_preference NOT NULL DEFAULT 'hp_kbm',
  target_length_band public.target_length_plan,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_settings_project_id_idx ON public.project_settings (project_id);

CREATE TRIGGER project_settings_set_updated_at
  BEFORE UPDATE ON public.project_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- story_foundations (1:1 per project)
-- -----------------------------------------------------------------------------
CREATE TABLE public.story_foundations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects (id) ON DELETE CASCADE,
  premise text NOT NULL DEFAULT '',
  main_conflict text NOT NULL DEFAULT '',
  reader_promise text NOT NULL DEFAULT '',
  tone text,
  genre text,
  target_reader text,
  story_secrets_preview text,
  style_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_percent integer NOT NULL DEFAULT 0
    CHECK (readiness_percent >= 0 AND readiness_percent <= 100),
  readiness_status public.foundation_readiness_level NOT NULL DEFAULT 'belum_siap',
  status public.foundation_status NOT NULL DEFAULT 'draft',
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX story_foundations_project_id_idx ON public.story_foundations (project_id);

CREATE TRIGGER story_foundations_set_updated_at
  BEFORE UPDATE ON public.story_foundations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- characters
-- -----------------------------------------------------------------------------
CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  role_label text NOT NULL DEFAULT '',
  role public.character_role NOT NULL DEFAULT 'other',
  description text NOT NULL DEFAULT '',
  importance public.character_importance NOT NULL DEFAULT 'supporting',
  status public.character_status NOT NULL DEFAULT 'active',
  source public.character_source NOT NULL DEFAULT 'user',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX characters_project_id_idx ON public.characters (project_id);

CREATE TRIGGER characters_set_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ai_proposals (before facts — circular FK resolved below)
-- -----------------------------------------------------------------------------
CREATE TABLE public.ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  proposal_type public.ai_proposal_type NOT NULL,
  status public.ai_proposal_status NOT NULL DEFAULT 'proposed',
  risk_level public.ai_proposal_risk_level NOT NULL DEFAULT 'low',
  source public.ai_proposal_source NOT NULL DEFAULT 'user_manual',
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  merged_into_id uuid REFERENCES public.ai_proposals (id) ON DELETE SET NULL,
  result_fact_id uuid,
  result_character_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_proposals_project_id_idx ON public.ai_proposals (project_id);
CREATE INDEX ai_proposals_status_idx ON public.ai_proposals (status);
CREATE INDEX ai_proposals_project_status_idx ON public.ai_proposals (project_id, status);

CREATE TRIGGER ai_proposals_set_updated_at
  BEFORE UPDATE ON public.ai_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- facts (confirmed canon only — no ai_direct source)
-- -----------------------------------------------------------------------------
CREATE TABLE public.facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  text text NOT NULL,
  category public.fact_category NOT NULL,
  importance public.fact_importance NOT NULL DEFAULT 'minor',
  canon_status public.fact_canon_status NOT NULL DEFAULT 'confirmed',
  is_locked boolean NOT NULL DEFAULT false,
  source public.fact_source NOT NULL DEFAULT 'user',
  accepted_from_proposal_id uuid REFERENCES public.ai_proposals (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX facts_project_id_idx ON public.facts (project_id);

CREATE TRIGGER facts_set_updated_at
  BEFORE UPDATE ON public.facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Deferred FKs: ai_proposals → facts / characters
ALTER TABLE public.ai_proposals
  ADD CONSTRAINT ai_proposals_result_fact_id_fkey
  FOREIGN KEY (result_fact_id) REFERENCES public.facts (id) ON DELETE SET NULL;

ALTER TABLE public.ai_proposals
  ADD CONSTRAINT ai_proposals_result_character_id_fkey
  FOREIGN KEY (result_character_id) REFERENCES public.characters (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- relationship_speech_rules
-- -----------------------------------------------------------------------------
CREATE TABLE public.relationship_speech_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  relationship_label text NOT NULL,
  character_a_id uuid REFERENCES public.characters (id) ON DELETE SET NULL,
  character_b_id uuid REFERENCES public.characters (id) ON DELETE SET NULL,
  rule_text text NOT NULL,
  examples jsonb,
  status public.speech_rule_status NOT NULL DEFAULT 'active',
  source public.speech_rule_source NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX relationship_speech_rules_project_id_idx
  ON public.relationship_speech_rules (project_id);

CREATE TRIGGER relationship_speech_rules_set_updated_at
  BEFORE UPDATE ON public.relationship_speech_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- credit_balances (1:1 per user, display-only Sprint 2)
-- -----------------------------------------------------------------------------
CREATE TABLE public.credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  monthly_quota integer NOT NULL DEFAULT 0 CHECK (monthly_quota >= 0),
  monthly_used integer NOT NULL DEFAULT 0 CHECK (monthly_used >= 0),
  reset_at date,
  source public.credit_balance_source NOT NULL DEFAULT 'seed',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_balances_user_id_idx ON public.credit_balances (user_id);

CREATE TRIGGER credit_balances_set_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs (append-only, API/service_role INSERT)
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type public.audit_entity_type,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX audit_logs_project_id_idx ON public.audit_logs (project_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_foundations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_speech_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- projects: owner only
CREATE POLICY projects_select_owner ON public.projects
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY projects_insert_owner ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_update_owner ON public.projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_delete_owner ON public.projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- project_settings: via project ownership; no client DELETE
CREATE POLICY project_settings_select_owner ON public.project_settings
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY project_settings_insert_owner ON public.project_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY project_settings_update_owner ON public.project_settings
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

-- story_foundations: via project ownership; no DELETE
CREATE POLICY story_foundations_select_owner ON public.story_foundations
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY story_foundations_insert_owner ON public.story_foundations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY story_foundations_update_owner ON public.story_foundations
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

-- characters
CREATE POLICY characters_select_owner ON public.characters
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY characters_insert_owner ON public.characters
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND source IN ('user', 'system_seed', 'accepted_proposal')
  );

CREATE POLICY characters_update_owner ON public.characters
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY characters_delete_owner ON public.characters
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- facts: confirmed canon; no DELETE (deprecate via canon_status)
CREATE POLICY facts_select_owner ON public.facts
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY facts_insert_owner ON public.facts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND source IN ('user', 'system', 'accepted_proposal', 'imported_draft')
  );

CREATE POLICY facts_update_owner ON public.facts
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (
    public.is_project_owner(project_id)
    AND source IN ('user', 'system', 'accepted_proposal', 'imported_draft')
  );

-- relationship_speech_rules
CREATE POLICY speech_rules_select_owner ON public.relationship_speech_rules
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY speech_rules_insert_owner ON public.relationship_speech_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND source IN ('user', 'accepted_proposal')
  );

CREATE POLICY speech_rules_update_owner ON public.relationship_speech_rules
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY speech_rules_delete_owner ON public.relationship_speech_rules
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- ai_proposals: default proposed on create; no DELETE
CREATE POLICY ai_proposals_select_owner ON public.ai_proposals
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY ai_proposals_insert_owner ON public.ai_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND status = 'proposed'
  );

CREATE POLICY ai_proposals_update_owner ON public.ai_proposals
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

-- credit_balances: read-only for authenticated (seed/update via service role)
CREATE POLICY credit_balances_select_own ON public.credit_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- audit_logs: read own actor or own project; append-only (no INSERT/UPDATE/DELETE for authenticated)
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND public.is_project_owner(project_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Grants (Supabase roles)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;

-- =============================================================================
-- Canon guardrails (enforced by schema + RLS + API in later tasks):
--   • facts.source enum excludes ai_direct / ai_* — AI output → ai_proposals first
--   • facts.canon_status defaults to confirmed
--   • ai_proposals.status defaults to proposed
--   • accept/reject/merged canon promotion → apps/api service layer (Task 2.11)
-- =============================================================================