-- =============================================================================
-- VibeNovel Sprint 7 — Publish package data model (Task 7.1)
-- Additive only: publish_packages
-- Enums align @vibenovel/shared | RLS owner-only via is_project_owner
-- NOT canon: publish_packages is KBM export artifact — manual copy only
-- No auto-post KBM | Not Context Packet source
-- metadata / text columns must NOT store planning_truth, packet_json, raw prose dump
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 7 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.publish_package_status AS ENUM (
  'draft',
  'ready',
  'exported',
  'superseded'
);

-- -----------------------------------------------------------------------------
-- publish_packages (export artifact — NOT canon)
-- checklist_json: fixed MVP checklist state (chk_teaser … chk_preview)
-- generator_version: text (not PG enum) — publish_stub_v1 default
-- -----------------------------------------------------------------------------
CREATE TABLE public.publish_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  chapter_outline_id uuid NOT NULL REFERENCES public.chapter_outlines (id) ON DELETE CASCADE,
  chapter_summary_id uuid NOT NULL REFERENCES public.chapter_summaries (id) ON DELETE CASCADE,
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  chapter_title text NOT NULL DEFAULT '',
  status public.publish_package_status NOT NULL DEFAULT 'draft',
  package_version integer NOT NULL DEFAULT 1 CHECK (package_version > 0),
  is_current boolean NOT NULL DEFAULT true,
  display_title text NOT NULL DEFAULT '',
  teaser text NOT NULL DEFAULT '',
  short_synopsis text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  reader_question text NOT NULL DEFAULT '',
  next_chapter_teaser text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  genre text,
  mobile_preview_excerpt text NOT NULL DEFAULT '',
  checklist_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  generator_version text NOT NULL DEFAULT 'publish_stub_v1',
  exported_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publish_packages_project_outline_version_unique
    UNIQUE (project_id, chapter_outline_id, package_version)
);

CREATE INDEX publish_packages_project_id_idx ON public.publish_packages (project_id);
CREATE INDEX publish_packages_chapter_outline_id_idx ON public.publish_packages (chapter_outline_id);
CREATE INDEX publish_packages_chapter_summary_id_idx ON public.publish_packages (chapter_summary_id);
CREATE INDEX publish_packages_status_idx ON public.publish_packages (status);
CREATE INDEX publish_packages_updated_at_idx ON public.publish_packages (updated_at);

CREATE UNIQUE INDEX publish_packages_one_current_per_chapter_idx
  ON public.publish_packages (project_id, chapter_outline_id)
  WHERE is_current = true;

CREATE TRIGGER publish_packages_set_updated_at
  BEFORE UPDATE ON public.publish_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.publish_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY publish_packages_select_owner ON public.publish_packages
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY publish_packages_insert_owner ON public.publish_packages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY publish_packages_update_owner ON public.publish_packages
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY publish_packages_delete_owner ON public.publish_packages
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_packages TO authenticated;
GRANT SELECT ON public.publish_packages TO anon;
GRANT ALL ON public.publish_packages TO service_role;

-- =============================================================================
-- Export guardrails (Task 7.1 — schema only):
--   • publish_packages is export artifact — NOT canon
--   • Does NOT auto-post to KBM — exported_at is local marker only
--   • Not a source for Context Packet builder
--   • metadata must not store planning_truth, packet_json, raw prose dump,
--     delta_json, or ai_proposal payloads
--   • checklist_json stores fixed MVP checklist state (5 items)
--   • No triggers writing to facts, characters, open_loops, reveals, summaries
-- =============================================================================