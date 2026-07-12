-- Migration: 042_journal_embeddings
-- Reflection Layer 2 (Option B): sparse TF embeddings stored as JSONB.
--
-- pgvector is enabled in this project but deliberately UNUSED here —
-- similarity runs in Python (sparse_cosine over the user's fetched rows) at
-- current scale. The `model` column exists so the future dense/pgvector
-- migration can re-embed exactly the rows that need it
-- (WHERE model = 'tfidf-sparse-minilm-compat').
--
-- Privacy: `embedding` holds {hashed_token: weight}. Tokens are hashed
-- before storage, so the JSONB is not readable vocabulary — embeddings are
-- for search, not reading. There is no text column, by design.

CREATE TABLE public.journal_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL UNIQUE REFERENCES reflections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding JSONB NOT NULL,
  model TEXT NOT NULL DEFAULT 'tfidf-sparse-minilm-compat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_embeddings_user ON public.journal_embeddings (user_id);

ALTER TABLE public.journal_embeddings ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny-all for clients, service role only.
-- The frontend never reads embeddings; only backend tools search them.
