-- Sprint 14+ hardening: WriterSafetyEnvelope column on context_packet_logs.
-- Server-only; NOT exposed via public API or Writer prompt.

ALTER TABLE public.context_packet_logs
  ADD COLUMN IF NOT EXISTS safety_envelope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_version text NOT NULL DEFAULT 'writer_safety_v1';

COMMENT ON COLUMN public.context_packet_logs.safety_envelope_json
  IS 'Server-only WriterSafetyEnvelope — NEVER sent to Writer model or public API.';
COMMENT ON COLUMN public.context_packet_logs.safety_version
  IS 'Envelope schema version for forward-compat migrations.';

-- The safety envelope (and the existing packet_json) are server-only and must
-- never be reachable through Supabase REST. Migration 00004 granted owner-level
-- table privileges to anon/authenticated, which would expose these columns once
-- populated. Postgres column-level REVOKE is a no-op against a table-level
-- grant, so revoke the client table grants outright: this audit log is only
-- ever read/written server-side via the service role (which keeps GRANT ALL
-- from 00004), and the web app never queries this table directly.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.context_packet_logs FROM authenticated;
REVOKE SELECT ON public.context_packet_logs FROM anon;
