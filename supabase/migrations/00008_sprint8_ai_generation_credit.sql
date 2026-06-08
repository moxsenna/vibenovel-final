-- =============================================================================
-- VibeNovel Sprint 8 — AI generation attempts + credit ledger (Task 8.1)
-- Additive only: generation_attempts, credit_ledger
-- Enums align @vibenovel/shared | RLS owner read; ledger service-only write
-- NOT included: RPC debit/refund, OpenRouter calls, AI endpoints (Task 8.2+)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 8 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.generation_type AS ENUM (
  'prose_beat',
  'prose_rewrite',
  'publish_copy',
  'summary_delta'
);

CREATE TYPE public.generation_status AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

CREATE TYPE public.credit_ledger_direction AS ENUM (
  'debit',
  'credit',
  'refund'
);

-- -----------------------------------------------------------------------------
-- Audit enum extension (Sprint 8 — generation + credit ledger events)
-- -----------------------------------------------------------------------------
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'generation_attempt';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'credit_ledger_entry';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'generation_attempt_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'generation_attempt_succeeded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'generation_attempt_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'credit_debited';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'credit_refunded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ai_output_persisted';

-- -----------------------------------------------------------------------------
-- generation_attempts (one row per idempotent AI call — lifecycle tracked)
-- prompt_hash only — never raw prompt.
-- metadata must not contain packet_json, planningTruth, raw prompt, provider secret, raw prose.
-- -----------------------------------------------------------------------------
CREATE TABLE public.generation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  chapter_outline_id uuid REFERENCES public.chapter_outlines (id) ON DELETE SET NULL,
  beat_id uuid REFERENCES public.chapter_beats (id) ON DELETE SET NULL,
  writing_session_id uuid REFERENCES public.writing_sessions (id) ON DELETE SET NULL,
  generation_type public.generation_type NOT NULL,
  status public.generation_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  provider text,
  model text,
  prompt_hash text,
  context_packet_log_id uuid REFERENCES public.context_packet_logs (id) ON DELETE SET NULL,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost_usd numeric CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  credit_cost integer NOT NULL DEFAULT 0 CHECK (credit_cost >= 0),
  error_code text,
  error_message_safe text,
  output_entity_type text,
  output_entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generation_attempts_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX generation_attempts_project_id_created_at_idx
  ON public.generation_attempts (project_id, created_at DESC);

CREATE INDEX generation_attempts_user_id_created_at_idx
  ON public.generation_attempts (user_id, created_at DESC);

CREATE INDEX generation_attempts_status_idx ON public.generation_attempts (status);

CREATE INDEX generation_attempts_generation_type_idx
  ON public.generation_attempts (generation_type);

CREATE INDEX generation_attempts_context_packet_log_id_idx
  ON public.generation_attempts (context_packet_log_id);

CREATE INDEX generation_attempts_status_running_idx
  ON public.generation_attempts (project_id, user_id)
  WHERE status = 'running';

CREATE TRIGGER generation_attempts_set_updated_at
  BEFORE UPDATE ON public.generation_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- credit_ledger (append-only — source of truth for credit mutations)
-- amount is always positive; direction determines debit/refund/credit.
-- no raw prompt/provider secret/prose in metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  attempt_id uuid REFERENCES public.generation_attempts (id) ON DELETE SET NULL,
  amount integer NOT NULL CHECK (amount > 0),
  direction public.credit_ledger_direction NOT NULL,
  reason text NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_ledger_user_id_created_at_idx
  ON public.credit_ledger (user_id, created_at DESC);

CREATE INDEX credit_ledger_project_id_created_at_idx
  ON public.credit_ledger (project_id, created_at DESC);

CREATE INDEX credit_ledger_attempt_id_idx ON public.credit_ledger (attempt_id);

CREATE INDEX credit_ledger_direction_idx ON public.credit_ledger (direction);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.generation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- generation_attempts: owner read via project or initiating user
CREATE POLICY generation_attempts_select_owner ON public.generation_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR user_id = auth.uid()
  );

CREATE POLICY generation_attempts_insert_owner ON public.generation_attempts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY generation_attempts_update_owner ON public.generation_attempts
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY generation_attempts_delete_owner ON public.generation_attempts
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- credit_ledger: owner read only — mutations via service_role (Task 8.3+)
CREATE POLICY credit_ledger_select_own ON public.credit_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_attempts TO authenticated;
GRANT SELECT ON public.generation_attempts TO anon;
GRANT ALL ON public.generation_attempts TO service_role;

GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;

-- =============================================================================
-- Sprint 8 guardrails (Task 8.1 — schema only):
--   • generation_attempts.prompt_hash only — never raw prompt in DB
--   • generation_attempts.metadata must not store packet_json, planningTruth,
--     raw prompt, provider secret, or raw prose (API responsibility)
--   • credit_ledger is append-only — no updated_at, no UPDATE trigger
--   • amount positive; direction enum determines debit/refund/credit semantics
--   • credit_ledger.metadata must not store raw prompt/provider secret/prose
--   • No RPC debit/refund in 8.1 — credit mutation deferred to Task 8.3
--   • AI output still draft-only via chapter_prose_versions (not canon)
-- =============================================================================