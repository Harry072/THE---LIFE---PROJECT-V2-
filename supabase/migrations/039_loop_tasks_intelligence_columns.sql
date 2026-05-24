-- ============================================================
-- Migration: 039_loop_tasks_intelligence_columns
-- Goal:
--   1. Add 4 intelligence fields (inner_work_layer, approach_angle,
--      journey_phase, ikigai_quadrant) for the Task Intelligence Layer.
--   2. Fix pre-existing mood constraint bug: neutral/calmer/sleepy are
--      valid values in SAFE_MOOD_LABELS and the frontend UI but were
--      missing from the DB check constraint, causing 400 on feedback.
-- ============================================================

-- ── 1. Add columns with safe defaults ────────────────────────────────────────

ALTER TABLE public.loop_tasks
  ADD COLUMN IF NOT EXISTS inner_work_layer TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approach_angle   TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS journey_phase    TEXT DEFAULT 'foundation',
  ADD COLUMN IF NOT EXISTS ikigai_quadrant  TEXT DEFAULT 'none';

-- ── 2. Check constraints (enum enforcement at DB level) ───────────────────────

ALTER TABLE public.loop_tasks
  DROP CONSTRAINT IF EXISTS loop_tasks_inner_work_layer_check;
ALTER TABLE public.loop_tasks
  ADD CONSTRAINT loop_tasks_inner_work_layer_check
  CHECK (inner_work_layer IN ('attachment','anger','distraction','ego','greed','acceptance','none'));

ALTER TABLE public.loop_tasks
  DROP CONSTRAINT IF EXISTS loop_tasks_approach_angle_check;
ALTER TABLE public.loop_tasks
  ADD CONSTRAINT loop_tasks_approach_angle_check
  CHECK (approach_angle IN ('direct','oblique','embodied','reflective'));

ALTER TABLE public.loop_tasks
  DROP CONSTRAINT IF EXISTS loop_tasks_journey_phase_check;
ALTER TABLE public.loop_tasks
  ADD CONSTRAINT loop_tasks_journey_phase_check
  CHECK (journey_phase IN ('foundation','recognition','integration'));

ALTER TABLE public.loop_tasks
  DROP CONSTRAINT IF EXISTS loop_tasks_ikigai_quadrant_check;
ALTER TABLE public.loop_tasks
  ADD CONSTRAINT loop_tasks_ikigai_quadrant_check
  CHECK (ikigai_quadrant IN ('passion','mission','vocation','profession','none'));

-- ── 3. Fix mood constraint (neutral/calmer/sleepy missing from original) ──────
-- Migration 031 added the mood constraint but omitted values used by the
-- backend (SAFE_MOOD_LABELS) and frontend (PostActionFeedbackModal).
-- Submitting "neutral" mood was causing a DB check violation → HTTP 400.

ALTER TABLE public.loop_tasks
  DROP CONSTRAINT IF EXISTS loop_tasks_feedback_mood_check;

ALTER TABLE public.loop_tasks
  ADD CONSTRAINT loop_tasks_feedback_mood_check
  CHECK (
    (post_action_mood IS NULL OR post_action_mood IN (
      'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
      'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
      'low', 'tired', 'anxious', 'overwhelmed', 'drained',
      'neutral', 'calmer', 'sleepy'
    ))
    AND (mood_before IS NULL OR mood_before IN (
      'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
      'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
      'low', 'tired', 'anxious', 'overwhelmed', 'drained',
      'neutral', 'calmer', 'sleepy'
    ))
    AND (mood_after IS NULL OR mood_after IN (
      'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
      'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
      'low', 'tired', 'anxious', 'overwhelmed', 'drained',
      'neutral', 'calmer', 'sleepy'
    ))
  );

-- ── 4. Index for non-repetition queries (task_intelligence reads last 14 days) ─

CREATE INDEX IF NOT EXISTS idx_loop_tasks_intelligence
  ON public.loop_tasks (user_id, for_date DESC, inner_work_layer, approach_angle)
  WHERE is_optional = false;
