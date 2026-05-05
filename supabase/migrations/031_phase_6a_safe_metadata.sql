-- ==========================================
-- Migration: 031_phase_6a_safe_metadata
-- Goal: Add safe adaptive metadata without storing raw personal text.
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.loop_tasks
  ADD COLUMN IF NOT EXISTS post_action_mood TEXT,
  ADD COLUMN IF NOT EXISTS mood_before TEXT,
  ADD COLUMN IF NOT EXISTS mood_after TEXT,
  ADD COLUMN IF NOT EXISTS task_friction_level TEXT,
  ADD COLUMN IF NOT EXISTS completion_state TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS skip_reason_label TEXT,
  ADD COLUMN IF NOT EXISTS feedback_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT,
  ADD COLUMN IF NOT EXISTS success_condition TEXT,
  ADD COLUMN IF NOT EXISTS smaller_version TEXT,
  ADD COLUMN IF NOT EXISTS post_completion_question TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loop_tasks_task_friction_level_check'
  ) THEN
    ALTER TABLE public.loop_tasks
      ADD CONSTRAINT loop_tasks_task_friction_level_check
      CHECK (
        task_friction_level IS NULL
        OR task_friction_level IN ('too_easy', 'right_sized', 'too_heavy')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loop_tasks_completion_state_check'
  ) THEN
    ALTER TABLE public.loop_tasks
      ADD CONSTRAINT loop_tasks_completion_state_check
      CHECK (
        completion_state IN ('pending', 'done', 'skipped', 'partial')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loop_tasks_difficulty_level_check'
  ) THEN
    ALTER TABLE public.loop_tasks
      ADD CONSTRAINT loop_tasks_difficulty_level_check
      CHECK (
        difficulty_level IS NULL
        OR difficulty_level IN ('gentle', 'normal', 'deeper')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loop_tasks_feedback_mood_check'
  ) THEN
    ALTER TABLE public.loop_tasks
      ADD CONSTRAINT loop_tasks_feedback_mood_check
      CHECK (
        (post_action_mood IS NULL OR post_action_mood IN (
          'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
          'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
          'low', 'tired', 'anxious', 'overwhelmed', 'drained'
        ))
        AND (mood_before IS NULL OR mood_before IN (
          'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
          'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
          'low', 'tired', 'anxious', 'overwhelmed', 'drained'
        ))
        AND (mood_after IS NULL OR mood_after IN (
          'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
          'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
          'low', 'tired', 'anxious', 'overwhelmed', 'drained'
        ))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loop_tasks_skip_reason_label_check'
  ) THEN
    ALTER TABLE public.loop_tasks
      ADD CONSTRAINT loop_tasks_skip_reason_label_check
      CHECK (
        skip_reason_label IS NULL
        OR skip_reason_label IN (
          'too_heavy', 'no_time', 'forgot', 'not_relevant',
          'low_energy', 'unclear'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loop_tasks_user_feedback
  ON public.loop_tasks(user_id, feedback_recorded_at DESC)
  WHERE feedback_recorded_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.reset_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  session_type TEXT,
  session_category TEXT,
  reset_need TEXT,
  duration_seconds INTEGER,
  mood_after TEXT,
  reflection_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reset_sessions_safe_metadata_check'
  ) THEN
    ALTER TABLE public.reset_sessions
      ADD CONSTRAINT reset_sessions_safe_metadata_check
      CHECK (
        (duration_seconds IS NULL OR duration_seconds >= 0)
        AND (mood_after IS NULL OR mood_after IN (
          'clear', 'clearer', 'focused', 'proud', 'soft', 'softer', 'quiet',
          'heavy', 'still_heavy', 'restless', 'grateful', 'hopeful', 'numb',
          'low', 'tired', 'anxious', 'overwhelmed', 'drained'
        ))
        AND (reflection_tag IS NULL OR reflection_tag IN (
          'less_pressure', 'less_noise', 'less_screen', 'less_rushing',
          'less_self_criticism', 'more_rest', 'more_clarity'
        ))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reset_sessions_user_created_at
  ON public.reset_sessions(user_id, created_at DESC);

ALTER TABLE public.reset_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reset_sessions'
      AND policyname = 'reset_sessions_select_own'
  ) THEN
    CREATE POLICY "reset_sessions_select_own"
      ON public.reset_sessions
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reset_sessions'
      AND policyname = 'reset_sessions_insert_own'
  ) THEN
    CREATE POLICY "reset_sessions_insert_own"
      ON public.reset_sessions
      FOR INSERT
      TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.curator_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT,
  path_slug TEXT,
  action_type TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'curator_interactions_action_type_check'
  ) THEN
    ALTER TABLE public.curator_interactions
      ADD CONSTRAINT curator_interactions_action_type_check
      CHECK (
        action_type IN (
          'path_opened',
          'book_opened',
          'book_saved',
          'book_removed',
          'find_book_opened'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'curator_interactions_duration_check'
  ) THEN
    ALTER TABLE public.curator_interactions
      ADD CONSTRAINT curator_interactions_duration_check
      CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_curator_interactions_user_created_at
  ON public.curator_interactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_interactions_user_path
  ON public.curator_interactions(user_id, path_slug, created_at DESC);

ALTER TABLE public.curator_interactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'curator_interactions'
      AND policyname = 'curator_interactions_select_own'
  ) THEN
    CREATE POLICY "curator_interactions_select_own"
      ON public.curator_interactions
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'curator_interactions'
      AND policyname = 'curator_interactions_insert_own'
  ) THEN
    CREATE POLICY "curator_interactions_insert_own"
      ON public.curator_interactions
      FOR INSERT
      TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

ALTER TABLE public.companion_messages
  ADD COLUMN IF NOT EXISTS companion_intent TEXT,
  ADD COLUMN IF NOT EXISTS resolved_action_type TEXT;

CREATE INDEX IF NOT EXISTS idx_companion_messages_user_intent
  ON public.companion_messages(user_id, companion_intent, created_at DESC)
  WHERE companion_intent IS NOT NULL;
