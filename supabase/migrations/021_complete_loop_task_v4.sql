-- ==========================================
-- RPC: complete_loop_task_v4 (SCHEMA ALIGNED)
-- Goal: Atomic completion + Real Schema Sync
-- ==========================================

CREATE OR REPLACE FUNCTION complete_loop_task_v4(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_new_vitality INTEGER;
  v_new_total_completed INTEGER;
  v_new_streak INTEGER;
  v_updated_task_json JSON;
BEGIN
  -- 1. Identify User and Context
  SELECT user_id INTO v_user_id
  FROM public.loop_tasks
  WHERE id = p_task_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Task % not found', p_task_id;
  END IF;

  -- 2. Mark Task Done and capture row
  UPDATE public.loop_tasks
  SET completed_at = NOW()
  WHERE id = p_task_id
  RETURNING row_to_json(public.loop_tasks.*) INTO v_updated_task_json;

  -- 3. Update User Tree (REAL SCHEMA: vitality + streak live here)
  -- Note: cumulative_score is removed as it doesn't exist in the actual table
  INSERT INTO public.user_tree (user_id, vitality, streak)
  VALUES (v_user_id, 60, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET vitality = LEAST(100, public.user_tree.vitality + 10),
      streak = public.user_tree.streak + 1,
      updated_at = NOW()
  RETURNING vitality, streak INTO v_new_vitality, v_new_streak;

  -- 4. Calculate True Total Completed (Source of Truth)
  SELECT COUNT(*) INTO v_new_total_completed
  FROM public.loop_tasks
  WHERE user_id = v_user_id AND completed_at IS NOT NULL;

  -- 5. Return Collective Sync Payload
  RETURN json_build_object(
    'status', 'success',
    'task', v_updated_task_json,
    'new_vitality', v_new_vitality,
    'new_total_completed', v_new_total_completed,
    'new_streak', v_new_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
