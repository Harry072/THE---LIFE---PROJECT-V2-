-- Migration: 005_create_modules
-- Links to: Design Spec Section 7 (Solution Modules)
 
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  science_note TEXT,
  icon TEXT NOT NULL DEFAULT 'BookOpen',
  day_count INTEGER NOT NULL CHECK (day_count BETWEEN 7 AND 30),
  struggle_tags JSONB NOT NULL,
  
  days_content JSONB NOT NULL,
 
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  -- Ref to community_rooms removed slightly to keep dependency clean. 
  -- We'll add FK in Community migration.
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE public.user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_day INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  
  days_completed JSONB DEFAULT '[]'::jsonb,
  
  CONSTRAINT unique_active_module UNIQUE (user_id, module_id)
);
 
CREATE INDEX idx_user_modules_active ON user_modules(user_id)
  WHERE completed_at IS NULL AND paused_at IS NULL;
 
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules ENABLE ROW LEVEL SECURITY;
