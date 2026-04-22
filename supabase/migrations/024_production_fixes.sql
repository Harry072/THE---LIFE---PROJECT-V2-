-- ==========================================
-- Migration: 024_production_fixes
-- Goal: Align user_tree schema and harden complete_loop_task_v4
-- Run this in your Supabase SQL Editor.
-- ==========================================

-- 1. Ensure user_tree has all required columns
ALTER TABLE public.user_tree 
ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cumulative_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vitality INTEGER DEFAULT 50;

-- 2. Production-hardened RPC
CREATE OR REPLACE FUNCTION complete_loop_task_v4(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_new_vitality INTEGER;
  v_new_streak INTEGER;
  v_new_score INTEGER;
  v_new_total_completed INTEGER;
  v_points INTEGER := 20;
  v_updated_task_json JSON;
BEGIN
  -- 1. Mark task done and get user_id in one atomic step
  UPDATE public.loop_tasks
  SET completed_at = NOW(),
      done = true
  WHERE id = p_task_id AND completed_at IS NULL
  RETURNING user_id, row_to_json(public.loop_tasks.*) INTO v_user_id, v_updated_task_json;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Task % not found or already completed', p_task_id;
  END IF;

  -- 2. Upsert User Tree (atomic score + streak + vitality)
  INSERT INTO public.user_tree (user_id, vitality, streak, cumulative_score)
  VALUES (v_user_id, 60, 1, v_points)
  ON CONFLICT (user_id) DO UPDATE
  SET vitality = LEAST(100, public.user_tree.vitality + 10),
      streak = public.user_tree.streak + 1,
      cumulative_score = public.user_tree.cumulative_score + v_points,
      updated_at = NOW()
  RETURNING vitality, streak, cumulative_score INTO v_new_vitality, v_new_streak, v_new_score;

  -- 3. Count total completed tasks for this user
  SELECT COUNT(*) INTO v_new_total_completed
  FROM public.loop_tasks
  WHERE user_id = v_user_id AND done = true;

  -- 4. Return full payload
  RETURN json_build_object(
    'status', 'success',
    'task', v_updated_task_json,
    'new_vitality', v_new_vitality,
    'new_total_completed', v_new_total_completed,
    'new_streak', v_new_streak,
    'new_score', v_new_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
