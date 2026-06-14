-- =============================================================================
-- VibeNovel Sprint 13 — first-class planning generation types
-- Additive only: extends generation_type enum used by generation_attempts.
-- Does not enable payment and does not depend on migration 00010.
-- =============================================================================

ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'concept_generation';
ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'foundation_proposal';
ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'outline_generation';
