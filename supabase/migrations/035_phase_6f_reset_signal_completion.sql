-- ==========================================
-- Migration: 035_phase_6f_reset_signal_completion
-- Goal: Narrow Reset Signal Completion Ritual metadata support.
-- ==========================================

ALTER TABLE public.reset_sessions
  ADD COLUMN IF NOT EXISTS session_title TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.reset_sessions
SET completed_at = COALESCE(completed_at, created_at, now())
WHERE completed_at IS NULL;

ALTER TABLE public.reset_sessions
  ALTER COLUMN completed_at SET DEFAULT now();

ALTER TABLE public.reset_sessions
  ALTER COLUMN completed_at SET NOT NULL;

ALTER TABLE public.reset_sessions
  DROP CONSTRAINT IF EXISTS reset_sessions_safe_metadata_check;

ALTER TABLE public.reset_sessions
  ADD CONSTRAINT reset_sessions_safe_metadata_check
  CHECK (
    (duration_seconds IS NULL OR duration_seconds >= 0)
    AND (mood_after IS NULL OR mood_after IN (
      'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
      'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
      'low', 'tired', 'anxious', 'overwhelmed', 'drained',
      'calmer', 'sleepy'
    ))
    AND (reflection_tag IS NULL OR reflection_tag IN (
      'less_pressure', 'less_noise', 'less_screen', 'less_rushing',
      'less_self_criticism', 'more_rest', 'more_clarity',
      'noise', 'pressure', 'overthinking', 'scrolling', 'loneliness', 'nothing_clear'
    ))
    AND (next_step_type IS NULL OR next_step_type IN (
      'loop', 'reset', 'rest', 'reflection', 'none'
    ))
  );

CREATE INDEX IF NOT EXISTS idx_reset_sessions_user_completed_at
  ON public.reset_sessions(user_id, completed_at DESC);
