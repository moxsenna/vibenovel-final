-- Sprint 16: Creator Mode and Advanced Controls
-- Adds an explicit opt-in mode while keeping simple mode as the default.

ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS creator_mode text NOT NULL DEFAULT 'simple'
  CHECK (creator_mode IN ('simple', 'advanced'));
