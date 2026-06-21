-- Sprint 14+ hardening: style profile and voice feedback tables.

CREATE TABLE IF NOT EXISTS public.style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  operational_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_prose_version_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.style_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_version_id uuid REFERENCES public.chapter_prose_versions(id) ON DELETE SET NULL,
  edited_version_id uuid REFERENCES public.chapter_prose_versions(id) ON DELETE SET NULL,
  feedback_type text NOT NULL,
  feedback_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_to_profile_version integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_prose_versions
  ADD COLUMN IF NOT EXISTS parent_version_id uuid REFERENCES public.chapter_prose_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS style_feedback_events_project_created_idx
  ON public.style_feedback_events (project_id, created_at DESC);

DROP TRIGGER IF EXISTS style_profiles_set_updated_at ON public.style_profiles;
CREATE TRIGGER style_profiles_set_updated_at
  BEFORE UPDATE ON public.style_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY style_profiles_select_owner ON public.style_profiles
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY style_profiles_insert_owner ON public.style_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY style_profiles_update_owner ON public.style_profiles
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY style_feedback_events_select_owner ON public.style_feedback_events
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY style_feedback_events_insert_owner ON public.style_feedback_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

GRANT SELECT, INSERT, UPDATE ON public.style_profiles TO authenticated;
GRANT SELECT, INSERT ON public.style_feedback_events TO authenticated;
GRANT ALL ON public.style_profiles TO service_role;
GRANT ALL ON public.style_feedback_events TO service_role;
