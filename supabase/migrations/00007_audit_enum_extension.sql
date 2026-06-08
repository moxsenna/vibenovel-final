-- =============================================================================
-- Sprint 7.8.2 — audit_action / audit_entity_type extension (additive only)
-- Aligns with docs/42-audit-action-enum-and-coverage-plan.md
-- =============================================================================

-- audit_entity_type additions (16)
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'intake_session';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'intake_message';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'detected_signal';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'story_concept';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'outline_plan';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'chapter_outline';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'open_loop';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'planned_reveal';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'writing_session';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'chapter_beat';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'chapter_prose_version';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'context_packet_log';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'chapter_summary';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'chapter_delta';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'chapter_summary_proposal';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'publish_package';

-- audit_action additions (37 — foundation_locked already exists in 00001)
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'intake_session_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'intake_message_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'detected_signal_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'detected_signal_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'story_concepts_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'story_concept_selected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'foundation_proposals_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'foundation_proposal_accepted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'foundation_lock_started';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'foundation_lock_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'outline_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_outline_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'open_loop_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'planned_reveal_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'outline_approved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'outline_locked';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'writing_session_started';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'writing_session_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_beats_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_beat_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'prose_version_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'prose_version_made_current';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'context_packet_built';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_ready_for_summary';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_summary_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_delta_extracted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'chapter_summary_approved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'summary_proposal_linked';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'summary_proposal_accepted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'summary_proposal_rejected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'canon_promotion_applied';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'canon_promotion_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'publish_package_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'publish_package_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'publish_checklist_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'publish_package_exported';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'publish_package_regenerated';