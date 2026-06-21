-- Sprint 12.1/12.2/12.3: beat, summary, intake, continuity generation types.
ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'intake_assistant';
ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'beat_generation';
ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'chapter_summary_generation';
ALTER TYPE public.generation_type ADD VALUE IF NOT EXISTS 'continuity_delta';
