-- Sprint 14 safety validation and AI cost guards.
-- Additive only: validation reports + configurable daily AI cap rows.

CREATE TABLE IF NOT EXISTS public.validation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  generation_attempt_id uuid REFERENCES public.generation_attempts (id) ON DELETE SET NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'blocked')),
  checks_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  repair_status text NOT NULL DEFAULT 'not_requested'
    CHECK (repair_status IN ('not_requested', 'requested', 'completed', 'failed')),
  repaired_from_report_id uuid REFERENCES public.validation_reports (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS validation_reports_project_id_idx
  ON public.validation_reports (project_id);
CREATE INDEX IF NOT EXISTS validation_reports_user_id_idx
  ON public.validation_reports (user_id);
CREATE INDEX IF NOT EXISTS validation_reports_generation_attempt_id_idx
  ON public.validation_reports (generation_attempt_id);
CREATE INDEX IF NOT EXISTS validation_reports_severity_idx
  ON public.validation_reports (severity);

DROP TRIGGER IF EXISTS validation_reports_set_updated_at ON public.validation_reports;
CREATE TRIGGER validation_reports_set_updated_at
  BEFORE UPDATE ON public.validation_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_usage_daily_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  daily_credit_cap integer NOT NULL DEFAULT 200 CHECK (daily_credit_cap > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_daily_caps_user_project_unique UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS ai_usage_daily_caps_user_id_idx
  ON public.ai_usage_daily_caps (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_daily_caps_project_id_idx
  ON public.ai_usage_daily_caps (project_id);

DROP TRIGGER IF EXISTS ai_usage_daily_caps_set_updated_at ON public.ai_usage_daily_caps;
CREATE TRIGGER ai_usage_daily_caps_set_updated_at
  BEFORE UPDATE ON public.ai_usage_daily_caps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.validation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS validation_reports_select_owner ON public.validation_reports;
CREATE POLICY validation_reports_select_owner ON public.validation_reports
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS validation_reports_insert_owner ON public.validation_reports;
CREATE POLICY validation_reports_insert_owner ON public.validation_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_usage_daily_caps_select_owner ON public.ai_usage_daily_caps;
CREATE POLICY ai_usage_daily_caps_select_owner ON public.ai_usage_daily_caps
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.validation_reports TO authenticated;
GRANT SELECT ON public.ai_usage_daily_caps TO authenticated;
GRANT ALL ON public.validation_reports TO service_role;
GRANT ALL ON public.ai_usage_daily_caps TO service_role;
