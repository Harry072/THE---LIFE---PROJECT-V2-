-- ============================================================
-- Migration: 034_loop_tasks_framework
-- Goal: Add framework_key column for 30-day journey tracking.
--       Enables anti-repetition across 30 days and framework
--       rotation across Ikigai, Morita, Logotherapy, Flow, Symbol.
-- ============================================================

ALTER TABLE public.loop_tasks
  ADD COLUMN IF NOT EXISTS framework_key TEXT;

-- Partial index: fast journey-start lookup (first task date per user)
CREATE INDEX IF NOT EXISTS idx_loop_tasks_user_date_asc
  ON public.loop_tasks (user_id, for_date ASC)
  WHERE is_optional = false;

-- Fast anti-repetition lookup: all task titles for a user in last 30 days
CREATE INDEX IF NOT EXISTS idx_loop_tasks_user_date_desc
  ON public.loop_tasks (user_id, for_date DESC)
  WHERE is_optional = false;
