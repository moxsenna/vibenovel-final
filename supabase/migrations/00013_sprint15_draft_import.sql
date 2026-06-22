-- Sprint 15 draft import and continuation.
-- Draft text is stored server-side for signal extraction; API responses expose
-- only hash, excerpt preview, word count, status, and extracted signals.

CREATE TABLE IF NOT EXISTS public.draft_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_text text NOT NULL,
  content_hash text NOT NULL,
  excerpt_preview text NOT NULL,
  word_count integer NOT NULL CHECK (word_count >= 0),
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'signals_extracted', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS draft_imports_project_id_idx
  ON public.draft_imports (project_id);
CREATE INDEX IF NOT EXISTS draft_imports_owner_id_idx
  ON public.draft_imports (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS draft_imports_project_hash_idx
  ON public.draft_imports (project_id, content_hash);

CREATE TRIGGER draft_imports_set_updated_at
  BEFORE UPDATE ON public.draft_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.draft_import_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_import_id uuid NOT NULL REFERENCES public.draft_imports (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS draft_import_signals_draft_import_id_idx
  ON public.draft_import_signals (draft_import_id);
CREATE INDEX IF NOT EXISTS draft_import_signals_project_id_idx
  ON public.draft_import_signals (project_id);
CREATE INDEX IF NOT EXISTS draft_import_signals_owner_id_idx
  ON public.draft_import_signals (owner_id);

CREATE TRIGGER draft_import_signals_set_updated_at
  BEFORE UPDATE ON public.draft_import_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.draft_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_import_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY draft_imports_select_owner ON public.draft_imports
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY draft_imports_insert_owner ON public.draft_imports
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY draft_import_signals_select_owner ON public.draft_import_signals
  FOR SELECT USING (auth.uid() = owner_id);

GRANT SELECT, INSERT ON public.draft_imports TO authenticated;
GRANT SELECT ON public.draft_import_signals TO authenticated;
GRANT ALL ON public.draft_imports TO service_role;
GRANT ALL ON public.draft_import_signals TO service_role;
