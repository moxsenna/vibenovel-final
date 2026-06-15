-- Sprint 18.1 - draft import audit enum backfill
-- Keeps production audit_logs inserts aligned with shared audit action/entity constants.

ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'draft_import';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'draft_import_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'draft_import_signals_extracted';
