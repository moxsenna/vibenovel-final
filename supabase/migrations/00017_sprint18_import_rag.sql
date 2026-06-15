-- =============================================================================
-- Narraza Sprint 18 - Draft Import RAG Foundation
-- Additive only: import_jobs + prose_embeddings.
-- Guardrail: imported draft memory is read-only context. It never writes directly
-- to canon facts/characters; extraction output must become ai_proposals first.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE public.import_job_status AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

CREATE TYPE public.import_job_phase AS ENUM (
  'uploaded',
  'chunking',
  'embedding',
  'analysis',
  'entity_extraction',
  'style_extraction',
  'ready_for_review'
);

CREATE TYPE public.prose_embedding_source AS ENUM (
  'imported_draft'
);

-- -----------------------------------------------------------------------------
-- import_jobs (multi-phase recovery/progress state for Persona C draft prep)
-- -----------------------------------------------------------------------------
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  draft_import_id uuid REFERENCES public.draft_imports (id) ON DELETE CASCADE,
  status public.import_job_status NOT NULL DEFAULT 'pending',
  current_phase public.import_job_phase NOT NULL DEFAULT 'uploaded',
  progress_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  error_code text,
  error_message_safe text,
  phase_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_jobs_project_id_idx ON public.import_jobs (project_id);
CREATE INDEX import_jobs_owner_id_idx ON public.import_jobs (owner_id);
CREATE INDEX import_jobs_draft_import_id_idx ON public.import_jobs (draft_import_id);
CREATE INDEX import_jobs_project_status_phase_idx
  ON public.import_jobs (project_id, status, current_phase);

CREATE TRIGGER import_jobs_set_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prose_embeddings (RAG memory store; read-only context, never canon)
-- -----------------------------------------------------------------------------
CREATE TABLE public.prose_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  draft_import_id uuid REFERENCES public.draft_imports (id) ON DELETE CASCADE,
  import_job_id uuid REFERENCES public.import_jobs (id) ON DELETE SET NULL,
  source public.prose_embedding_source NOT NULL DEFAULT 'imported_draft',
  source_ref text NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index > 0),
  chunk_text text NOT NULL,
  chunk_hash text NOT NULL,
  word_count integer NOT NULL CHECK (word_count >= 0),
  embedding vector(1536),
  embedding_provider text,
  embedding_model text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prose_embeddings_project_source_ref_unique UNIQUE (project_id, source_ref)
);

CREATE INDEX prose_embeddings_project_id_idx ON public.prose_embeddings (project_id);
CREATE INDEX prose_embeddings_owner_id_idx ON public.prose_embeddings (owner_id);
CREATE INDEX prose_embeddings_draft_import_id_idx ON public.prose_embeddings (draft_import_id);
CREATE INDEX prose_embeddings_import_job_id_idx ON public.prose_embeddings (import_job_id);
CREATE INDEX prose_embeddings_project_source_idx ON public.prose_embeddings (project_id, source);
CREATE INDEX prose_embeddings_embedding_hnsw_idx
  ON public.prose_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER prose_embeddings_set_updated_at
  BEFORE UPDATE ON public.prose_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (owner-only; direct owner_id check keeps policy cheap and index-backed)
-- -----------------------------------------------------------------------------
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prose_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_jobs_select_owner ON public.import_jobs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = owner_id);

CREATE POLICY import_jobs_insert_owner ON public.import_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY import_jobs_update_owner ON public.import_jobs
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY prose_embeddings_select_owner ON public.prose_embeddings
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = owner_id);

CREATE POLICY prose_embeddings_insert_owner ON public.prose_embeddings
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY prose_embeddings_update_owner ON public.prose_embeddings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.import_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prose_embeddings TO authenticated;

GRANT ALL ON public.import_jobs TO service_role;
GRANT ALL ON public.prose_embeddings TO service_role;

-- =============================================================================
-- Canon guardrails:
--   * prose_embeddings are context memory only.
--   * import_jobs only track progress/recovery, not story truth.
--   * No trigger writes to facts, characters, relationship_speech_rules, or
--     story_foundations.
--   * Imported entity/style findings must be reviewed through ai_proposals.
-- =============================================================================
