-- Sprint 14+ hardening: WriterSafetyEnvelope column on context_packet_logs.
-- Server-only; NOT exposed via public API or Writer prompt.

ALTER TABLE public.context_packet_logs
  ADD COLUMN IF NOT EXISTS safety_envelope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_version text NOT NULL DEFAULT 'writer_safety_v1';

COMMENT ON COLUMN public.context_packet_logs.safety_envelope_json
  IS 'Server-only WriterSafetyEnvelope — NEVER sent to Writer model or public API.';
COMMENT ON COLUMN public.context_packet_logs.safety_version
  IS 'Envelope schema version for forward-compat migrations.';
