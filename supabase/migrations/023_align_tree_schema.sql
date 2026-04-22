-- Align user_tree schema with production requirements
-- Adds missing 'streak' column and ensures 'cumulative_score' exists

ALTER TABLE public.user_tree 
ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cumulative_score INTEGER DEFAULT 0;

-- Update the RPC to correctly handle all three metrics
CREATE OR REPLACE FUNCTION complete_loop_task_v4(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_new_vitality INTEGER;
  v_new_total_completed INTEGER;
  v_new_streak INTEGER;
  v_new_score INTEGER;
  v_points INTEGER := 20; -- Standard points per task
  v_updated_task_json JSON;
BEGIN
  -- 1. Identify User
  SELECT user_id INTO v_user_id
  FROM public.loop_tasks
  WHERE id = p_task_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Task % not found', p_task_id;
  END IF;

  -- 2. Mark Task Done
  UPDATE public.loop_tasks
  SET completed_at = NOW()
  WHERE id = p_task_id
  RETURNING row_to_json(public.loop_tasks.*) INTO v_updated_task_json;

  -- 3. Update User Tree (Atomic)
  INSERT INTO public.user_tree (user_id, vitality, streak, cumulative_score)
  VALUES (v_user_id, 50, 1, v_points)
  ON CONFLICT (user_id) DO UPDATE
  SET vitality = LEAST(100, public.user_tree.vitality + 10),
      streak = public.user_tree.streak + 1,
      cumulative_score = public.user_tree.cumulative_score + v_points,
      updated_at = NOW()
  RETURNING vitality, streak, cumulative_score INTO v_new_vitality, v_new_streak, v_new_score;

  -- 4. Count total
  SELECT COUNT(*) INTO v_new_total_completed
  FROM public.loop_tasks
  WHERE user_id = v_user_id AND completed_at IS NOT NULL;

  -- 5. Return payload
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
