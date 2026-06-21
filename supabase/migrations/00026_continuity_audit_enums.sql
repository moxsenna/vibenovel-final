ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'character_state';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'character_knowledge';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'continuity_state_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'continuity_knowledge_updated';
