-- ==========================================
-- Migration: 032_phase_6c_reset_completion
-- Goal: Expand reset_sessions to support Phase 6C completion ritual.
--       Adds next_step_type column and widens mood/tag allowlists.
-- ==========================================

-- Add next_step_type column (safe enum)
ALTER TABLE public.reset_sessions
  ADD COLUMN IF NOT EXISTS next_step_type TEXT;

-- Drop the existing combined constraint so we can widen the allowlists
ALTER TABLE public.reset_sessions
  DROP CONSTRAINT IF EXISTS reset_sessions_safe_metadata_check;

-- Re-add with expanded mood values (calmer, sleepy) and new reflection tags
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
      'loop', 'reset', 'rest', 'none'
    ))
  );

-- Index for dashboard whisper lookups (user's latest reset session)
CREATE INDEX IF NOT EXISTS idx_reset_sessions_user_next_step
  ON public.reset_sessions(user_id, next_step_type, created_at DESC)
  WHERE next_step_type IS NOT NULL;
