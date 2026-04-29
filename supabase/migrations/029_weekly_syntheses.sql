-- ==========================================
-- Migration: 029_weekly_syntheses
-- Goal: Store Weekly Mirror syntheses without raw reflection text.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.weekly_syntheses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'fallback', 'insufficient_data')),
  synthesis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_version TEXT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, week_end)
);

CREATE INDEX IF NOT EXISTS idx_weekly_syntheses_user_week
  ON public.weekly_syntheses(user_id, week_start DESC, week_end DESC);

ALTER TABLE public.weekly_syntheses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_syntheses'
      AND policyname = 'weekly_syntheses_select_own'
  ) THEN
    CREATE POLICY "weekly_syntheses_select_own"
      ON public.weekly_syntheses
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_syntheses'
      AND policyname = 'weekly_syntheses_insert_own'
  ) THEN
    CREATE POLICY "weekly_syntheses_insert_own"
      ON public.weekly_syntheses
      FOR INSERT
      TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_syntheses'
      AND policyname = 'weekly_syntheses_update_own'
  ) THEN
    CREATE POLICY "weekly_syntheses_update_own"
      ON public.weekly_syntheses
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
