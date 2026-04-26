-- ==========================================
-- Migration: 026_task_engine_growth_core
-- Goal: Canonical loop_tasks growth scoring, duplicate-safe task engine.
-- Idempotent and non-destructive for completed task history.
-- ==========================================

-- 1. Canonical task table fields
ALTER TABLE public.loop_tasks
  ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;

-- Keep the boolean in sync for already-completed history without deleting anything.
UPDATE public.loop_tasks
SET completed_at = COALESCE(completed_at, created_at, now())
WHERE COALESCE(done, false) = true
  AND completed_at IS NULL;

UPDATE public.loop_tasks
SET done = true
WHERE completed_at IS NOT NULL
  AND COALESCE(done, false) = false;

-- 2. Growth state fields
CREATE TABLE IF NOT EXISTS public.user_tree (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cumulative_score INTEGER DEFAULT 0,
  vitality INTEGER DEFAULT 50,
  streak INTEGER DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_tree
  ADD COLUMN IF NOT EXISTS cumulative_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vitality INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Daily growth log fields
CREATE TABLE IF NOT EXISTS public.tree_daily_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points INTEGER DEFAULT 0,
  tasks_done INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  all_tasks_bonus_awarded BOOLEAN DEFAULT false,
  streak_bonus_awarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, for_date)
);

ALTER TABLE public.tree_daily_log
  ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasks_done INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasks_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_tasks_bonus_awarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_bonus_awarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.user_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_daily_log ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tree_user_id_unique
  ON public.user_tree(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_daily_log_user_date_unique
  ON public.tree_daily_log(user_id, for_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_tree'
      AND policyname = 'tree_own'
  ) THEN
    CREATE POLICY "tree_own" ON public.user_tree
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tree_daily_log'
      AND policyname = 'log_own'
  ) THEN
    CREATE POLICY "log_own" ON public.tree_daily_log
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. User behavior aggregate table safety net
CREATE TABLE IF NOT EXISTS public.user_behavior (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  core_struggles TEXT[],
  initial_energy TEXT,
  avg_completion_rate REAL DEFAULT 0.5,
  preferred_time TEXT DEFAULT 'morning',
  skipped_categories TEXT[],
  engaged_categories TEXT[],
  mood_trend TEXT[],
  avg_mood_score REAL DEFAULT 5,
  streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  total_reflections INTEGER DEFAULT 0,
  days_since_last_active INTEGER DEFAULT 0,
  why_button_clicks INTEGER DEFAULT 0,
  avg_time_to_complete REAL DEFAULT 0,
  therapeutic_mode TEXT DEFAULT 'standard',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_behavior ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_behavior'
      AND policyname = 'behavior_own'
  ) THEN
    CREATE POLICY "behavior_own" ON public.user_behavior
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Remove only duplicate incomplete generated core tasks.
-- Completed history is never deleted.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, for_date, category
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM public.loop_tasks
  WHERE COALESCE(ai_generated, true) = true
    AND COALESCE(is_optional, false) = false
    AND category IN ('awareness', 'action', 'meaning')
    AND completed_at IS NULL
    AND COALESCE(done, false) = false
)
DELETE FROM public.loop_tasks AS task
USING ranked
WHERE task.id = ranked.id
  AND ranked.duplicate_rank > 1;

-- 6. Prevent future duplicate incomplete generated core tasks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_unique_incomplete_generated_core
  ON public.loop_tasks(user_id, for_date, category)
  WHERE COALESCE(ai_generated, true) = true
    AND COALESCE(is_optional, false) = false
    AND category IN ('awareness', 'action', 'meaning')
    AND completed_at IS NULL
    AND COALESCE(done, false) = false;

-- 7. Vitality is derived from the last 7 days of growth points.
CREATE OR REPLACE FUNCTION public.calc_vitality(uid UUID)
RETURNS INTEGER AS $$
DECLARE
  total_pts INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0)
  INTO total_pts
  FROM public.tree_daily_log
  WHERE user_id = uid
    AND for_date >= CURRENT_DATE - INTERVAL '6 days';

  RETURN LEAST(100, GREATEST(0, ROUND(
    (total_pts::REAL / GREATEST(1, 7 * 50)) * 100
  )::INTEGER));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Atomic task completion + growth scoring.
CREATE OR REPLACE FUNCTION public.complete_loop_task_v4(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
  v_task public.loop_tasks%ROWTYPE;
  v_updated_task_json JSON;
  v_user_id UUID;
  v_for_date DATE;
  v_is_core BOOLEAN;
  v_base_points INTEGER := 0;
  v_bonus_points INTEGER := 0;
  v_streak_bonus_points INTEGER := 0;
  v_awarded_points INTEGER := 0;
  v_completed_core_count INTEGER := 0;
  v_core_total INTEGER := 0;
  v_all_tasks_complete BOOLEAN := false;
  v_all_bonus_awarded BOOLEAN := false;
  v_streak_bonus_awarded BOOLEAN := false;
  v_current_score INTEGER := 0;
  v_current_streak INTEGER := 0;
  v_new_score INTEGER := 0;
  v_new_vitality INTEGER := 50;
  v_new_streak INTEGER := 0;
  v_last_completed_date DATE;
  v_total_tasks_completed INTEGER := 0;
BEGIN
  SELECT *
  INTO v_task
  FROM public.loop_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', p_task_id;
  END IF;

  IF auth.uid() IS NULL OR v_task.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to complete this task';
  END IF;

  v_user_id := v_task.user_id;
  v_for_date := v_task.for_date;
  v_is_core := COALESCE(v_task.is_optional, false) = false
    AND v_task.category IN ('awareness', 'action', 'meaning');

  INSERT INTO public.user_tree (
    user_id,
    cumulative_score,
    vitality,
    streak,
    updated_at
  )
  VALUES (v_user_id, 0, 50, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.tree_daily_log (
    user_id,
    for_date,
    points,
    tasks_done,
    tasks_total,
    all_tasks_bonus_awarded,
    streak_bonus_awarded
  )
  VALUES (v_user_id, v_for_date, 0, 0, 0, false, false)
  ON CONFLICT (user_id, for_date) DO NOTHING;

  SELECT
    COALESCE(cumulative_score, 0),
    COALESCE(streak, 0),
    last_completed_date
  INTO
    v_current_score,
    v_current_streak,
    v_last_completed_date
  FROM public.user_tree
  WHERE user_id = v_user_id
  FOR UPDATE;

  SELECT
    COALESCE(all_tasks_bonus_awarded, false),
    COALESCE(streak_bonus_awarded, false)
  INTO
    v_all_bonus_awarded,
    v_streak_bonus_awarded
  FROM public.tree_daily_log
  WHERE user_id = v_user_id
    AND for_date = v_for_date
  FOR UPDATE;

  IF v_task.completed_at IS NULL THEN
    UPDATE public.loop_tasks AS task
    SET completed_at = now(),
        done = true
    WHERE task.id = p_task_id
      AND task.completed_at IS NULL
    RETURNING row_to_json(task.*) INTO v_updated_task_json;

    IF v_updated_task_json IS NULL THEN
      SELECT row_to_json(t.*)
      INTO v_updated_task_json
      FROM public.loop_tasks AS t
      WHERE t.id = p_task_id;
    END IF;

    IF v_is_core THEN
      v_base_points := 10;
    END IF;
  ELSE
    SELECT row_to_json(t.*)
    INTO v_updated_task_json
    FROM public.loop_tasks AS t
    WHERE t.id = p_task_id;
  END IF;

  SELECT COUNT(DISTINCT category)
  INTO v_completed_core_count
  FROM public.loop_tasks
  WHERE user_id = v_user_id
    AND for_date = v_for_date
    AND COALESCE(is_optional, false) = false
    AND category IN ('awareness', 'action', 'meaning')
    AND completed_at IS NOT NULL;

  SELECT COUNT(DISTINCT category)
  INTO v_core_total
  FROM public.loop_tasks
  WHERE user_id = v_user_id
    AND for_date = v_for_date
    AND COALESCE(is_optional, false) = false
    AND category IN ('awareness', 'action', 'meaning');

  v_core_total := GREATEST(v_core_total, 3);
  v_all_tasks_complete := v_completed_core_count >= 3;

  IF v_base_points > 0 AND v_all_tasks_complete AND NOT v_all_bonus_awarded THEN
    v_bonus_points := 15;
    v_all_bonus_awarded := true;
  END IF;

  v_new_streak := v_current_streak;

  IF v_base_points > 0 THEN
    IF v_last_completed_date IS NULL THEN
      v_new_streak := 1;
    ELSIF v_last_completed_date = v_for_date THEN
      v_new_streak := GREATEST(v_current_streak, 1);
    ELSIF v_last_completed_date = v_for_date - 1 THEN
      v_new_streak := GREATEST(v_current_streak, 0) + 1;
      IF NOT v_streak_bonus_awarded THEN
        v_streak_bonus_points := 5;
        v_streak_bonus_awarded := true;
      END IF;
    ELSIF v_last_completed_date < v_for_date - 1 THEN
      v_new_streak := 1;
    END IF;
  END IF;

  v_awarded_points := v_base_points + v_bonus_points + v_streak_bonus_points;

  UPDATE public.tree_daily_log
  SET points = COALESCE(points, 0) + v_awarded_points,
      tasks_done = v_completed_core_count,
      tasks_total = v_core_total,
      all_tasks_bonus_awarded = v_all_bonus_awarded,
      streak_bonus_awarded = v_streak_bonus_awarded
  WHERE user_id = v_user_id
    AND for_date = v_for_date;

  v_new_vitality := public.calc_vitality(v_user_id);
  v_new_score := v_current_score + v_awarded_points;

  UPDATE public.user_tree
  SET cumulative_score = v_new_score,
      vitality = v_new_vitality,
      streak = v_new_streak,
      last_completed_date = CASE
        WHEN v_base_points > 0 THEN v_for_date
        ELSE last_completed_date
      END,
      updated_at = now()
  WHERE user_id = v_user_id;

  SELECT COUNT(*)
  INTO v_total_tasks_completed
  FROM public.loop_tasks
  WHERE user_id = v_user_id
    AND COALESCE(is_optional, false) = false
    AND category IN ('awareness', 'action', 'meaning')
    AND completed_at IS NOT NULL;

  INSERT INTO public.user_behavior (
    user_id,
    streak,
    longest_streak,
    total_tasks_completed,
    avg_completion_rate,
    updated_at
  )
  VALUES (
    v_user_id,
    v_new_streak,
    v_new_streak,
    v_total_tasks_completed,
    LEAST(1, v_completed_core_count::REAL / GREATEST(1, v_core_total)),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET streak = v_new_streak,
      longest_streak = GREATEST(
        COALESCE(public.user_behavior.longest_streak, 0),
        v_new_streak
      ),
      total_tasks_completed = v_total_tasks_completed,
      avg_completion_rate = LEAST(1, v_completed_core_count::REAL / GREATEST(1, v_core_total)),
      updated_at = now();

  RETURN json_build_object(
    'status', CASE WHEN v_awarded_points > 0 THEN 'success' ELSE 'already_completed' END,
    'task', v_updated_task_json,
    'new_vitality', v_new_vitality,
    'new_total_completed_today', v_completed_core_count,
    'today_tasks_total', v_core_total,
    'new_streak', v_new_streak,
    'new_score', v_new_score,
    'awarded_points', v_awarded_points,
    'all_tasks_complete', v_all_tasks_complete
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
