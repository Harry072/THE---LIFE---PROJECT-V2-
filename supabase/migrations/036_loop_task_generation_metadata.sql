-- ============================================================
-- Migration: 036_loop_task_generation_metadata
-- Goal: Track whether Loop tasks came from Gemini or the
--       explicit safe fallback after a retry.
-- ============================================================

ALTER TABLE public.loop_tasks
  ADD COLUMN IF NOT EXISTS generation_provider TEXT,
  ADD COLUMN IF NOT EXISTS generation_model TEXT,
  ADD COLUMN IF NOT EXISTS generation_prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS generation_failure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_loop_tasks_generation_provider
  ON public.loop_tasks (user_id, for_date DESC, generation_provider)
  WHERE is_optional = false;
