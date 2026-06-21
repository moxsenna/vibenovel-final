-- Sprint 19: Asisten Narra unified agent phase and readiness bands.
-- Additive only. Existing sessions remain valid.

ALTER TYPE public.intake_phase ADD VALUE IF NOT EXISTS 'foundation_refinement';

ALTER TYPE public.foundation_readiness_level ADD VALUE IF NOT EXISTS 'siap_dimatangkan';
ALTER TYPE public.foundation_readiness_level ADD VALUE IF NOT EXISTS 'sangat_siap';
