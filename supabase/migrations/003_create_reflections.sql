-- Migration: 003_create_reflections
-- Links to: Design Spec Section 5 (Reflection Engine)
 
CREATE TABLE public.reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
 
  -- Answers (3 questions per session)
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
 
  -- Analysis (populated by Edge Function after submission)
  pattern_tags JSONB DEFAULT '[]'::jsonb,  -- ["avoidance","hope","self_criticism"]
  word_count INTEGER,
  vocabulary_diversity REAL,  -- unique words / total words
  sentiment_score REAL,       -- -1.0 to 1.0
  quality_score REAL,         -- 0.0 to 1.0 (composite of above)
 
  -- Behavioral Insight (surfaced after 14+ days)
  insight_generated BOOLEAN NOT NULL DEFAULT false,
  insight_text TEXT,
 
  -- Mental health signal detection
  distress_flag BOOLEAN NOT NULL DEFAULT false,
  distress_keywords JSONB DEFAULT '[]'::jsonb
);
 
-- Indexes
CREATE INDEX idx_reflections_user_date ON reflections(user_id, reflection_date);
CREATE INDEX idx_reflections_distress ON reflections(user_id)
  WHERE distress_flag = true;
 
-- One reflection per user per day
CREATE UNIQUE INDEX idx_reflections_unique_daily
  ON reflections(user_id, reflection_date);
 
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
