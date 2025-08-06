-- Fix the security issue for the match_documents function
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  content text,
  page_number int,
  chunk_index int,
  similarity float,
  documents jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'user_id', d.user_id
    ) AS documents
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    (user_id IS NULL OR d.user_id = match_documents.user_id)
    AND d.status = 'completed'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;