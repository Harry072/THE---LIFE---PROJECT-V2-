-- ============================================================
-- Migration: 037_loop_tasks_kotler_tag
-- Goal: Persist Steven Kotler motivational tag for Ustad V4
--       Loop task generation while keeping old rows valid.
-- ============================================================

ALTER TABLE public.loop_tasks
  ADD COLUMN IF NOT EXISTS kotler_tag TEXT;

ALTER TABLE public.loop_tasks
  DROP CONSTRAINT IF EXISTS loop_tasks_kotler_tag_check;

ALTER TABLE public.loop_tasks
  ADD CONSTRAINT loop_tasks_kotler_tag_check
  CHECK (
    kotler_tag IS NULL
    OR kotler_tag IN ('Curiosity', 'Purpose', 'Passion', 'Autonomy', 'Mastery')
  );

CREATE INDEX IF NOT EXISTS idx_loop_tasks_kotler_tag
  ON public.loop_tasks (user_id, for_date DESC, kotler_tag)
  WHERE is_optional = false AND kotler_tag IS NOT NULL;
