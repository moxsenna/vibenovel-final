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
