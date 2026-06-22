-- AI model registry routing — additive provider-call telemetry.
-- Adds final route-summary columns to generation_attempts and an admin-only
-- per-provider-call diagnostics table. No prompts, outputs, model thoughts,
-- provider response bodies, or credentials are ever stored here.

ALTER TABLE public.generation_attempts
  ADD COLUMN IF NOT EXISTS logical_model text,
  ADD COLUMN IF NOT EXISTS routing_policy_version text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0
    CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS provider_latency_ms integer
    CHECK (provider_latency_ms IS NULL OR provider_latency_ms >= 0);

CREATE TABLE public.generation_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_attempt_id uuid NOT NULL
    REFERENCES public.generation_attempts (id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  route_role text NOT NULL CHECK (route_role IN ('primary', 'fallback')),
  provider text NOT NULL,
  logical_model text NOT NULL,
  provider_model_id text NOT NULL,
  retry_number integer NOT NULL DEFAULT 0 CHECK (retry_number >= 0),
  outcome text NOT NULL CHECK (
    outcome IN (
      'succeeded',
      'provider_error',
      'timeout',
      'rate_limited',
      'empty_output',
      'invalid_output',
      'unsafe_output',
      'credential_unavailable',
      'configuration_error'
    )
  ),
  error_category text,
  error_code_safe text,
  provider_http_status integer
    CHECK (
      provider_http_status IS NULL OR
      provider_http_status BETWEEN 100 AND 599
    ),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost_usd numeric
    CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generation_provider_events_attempt_sequence_unique
    UNIQUE (generation_attempt_id, sequence_number)
);

CREATE INDEX generation_provider_events_attempt_created_idx
  ON public.generation_provider_events
  (generation_attempt_id, sequence_number);

CREATE INDEX generation_provider_events_provider_created_idx
  ON public.generation_provider_events
  (provider, created_at DESC);

ALTER TABLE public.generation_provider_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.generation_provider_events TO service_role;

COMMENT ON TABLE public.generation_provider_events IS
  'Admin-only provider call diagnostics. Never store prompts, outputs, model thoughts, provider response bodies, or credentials.';
