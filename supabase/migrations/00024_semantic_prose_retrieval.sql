-- Sprint 14+ hardening: semantic prose retrieval via pgvector similarity search.
-- Requires pgvector extension (already enabled via earlier migration).

CREATE OR REPLACE FUNCTION public.match_prose_embeddings(
  p_owner_id uuid,
  p_project_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer DEFAULT 5,
  p_min_similarity double precision DEFAULT 0.70
)
RETURNS TABLE (
  source_ref text,
  chunk_text text,
  similarity double precision,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    pe.source_ref,
    pe.chunk_text,
    1 - (pe.embedding <=> p_query_embedding) AS similarity,
    pe.metadata
  FROM public.prose_embeddings pe
  WHERE pe.owner_id = p_owner_id
    AND pe.project_id = p_project_id
    AND pe.embedding IS NOT NULL
    AND 1 - (pe.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY pe.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 8);
$$;

-- This RPC is SECURITY DEFINER and trusts the caller-supplied p_owner_id, so it
-- must never be reachable by anon/authenticated PostgREST callers (they could
-- pass another user's id and bypass RLS). Only the server-side service role —
-- which derives p_owner_id from a verified session — may execute it. Mirrors the
-- lockdown pattern in 00010_atomic_grant_credit_topup_rpc.sql.
REVOKE ALL ON FUNCTION public.match_prose_embeddings(
  uuid, uuid, vector(1536), integer, double precision
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.match_prose_embeddings(
  uuid, uuid, vector(1536), integer, double precision
) TO service_role;
