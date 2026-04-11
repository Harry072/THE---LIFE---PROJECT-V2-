-- Migration: 002_create_tasks
-- Links to: Design Spec Section 3 (Home / Daily Loop - Task Cards)
 
CREATE TYPE task_domain AS ENUM ('awareness', 'action', 'meaning');
 
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 
  -- Task Content
  domain task_domain NOT NULL,
  content TEXT NOT NULL,
  -- Source tracking for Phase 2 LLM personalization
  source TEXT NOT NULL DEFAULT 'rule_engine'
    CHECK (source IN ('rule_engine','llm','module')),
 
  -- State
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN NOT NULL DEFAULT false,
  skipped_at TIMESTAMPTZ,
 
  -- Context (for personalization engine)
  struggle_tags JSONB,      -- which tags influenced this task
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
 
  -- Quality (set by reflection analyzer)
  completion_quality REAL,  -- NULL until reflected on
 
  CONSTRAINT one_action CHECK (
    NOT (completed_at IS NOT NULL AND skipped = true)
  )
);
 
-- Indexes for daily queries
CREATE INDEX idx_tasks_user_date ON tasks(user_id, assigned_date);
CREATE INDEX idx_tasks_user_completed ON tasks(user_id, completed_at)
  WHERE completed_at IS NOT NULL;
 
-- Unique: max 3 tasks per user per day
CREATE UNIQUE INDEX idx_tasks_user_date_domain
  ON tasks(user_id, assigned_date, domain);
 
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
