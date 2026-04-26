-- Night Reflection Phase 1 Core
-- Migration 013 already normalizes reflection_date/answers into for_date/questions.
-- This migration only adds updated_at support and narrows broad reflection RLS.

ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.reflections
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.reflections
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reflections'
      AND policyname = 'reflections_own'
      AND cmd = 'ALL'
  ) THEN
    DROP POLICY "reflections_own" ON public.reflections;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reflections'
      AND policyname = 'reflections_owner'
      AND cmd = 'ALL'
  ) THEN
    DROP POLICY "reflections_owner" ON public.reflections;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reflections'
      AND policyname = 'reflections_select_own_phase1'
  ) THEN
    CREATE POLICY "reflections_select_own_phase1"
      ON public.reflections
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reflections'
      AND policyname = 'reflections_insert_own_phase1'
  ) THEN
    CREATE POLICY "reflections_insert_own_phase1"
      ON public.reflections
      FOR INSERT
      TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reflections'
      AND policyname = 'reflections_update_own_phase1'
  ) THEN
    CREATE POLICY "reflections_update_own_phase1"
      ON public.reflections
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
