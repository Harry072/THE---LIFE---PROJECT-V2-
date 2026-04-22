-- Migration: 016_complete_task_rpc
-- Atomic task completion and metrics update

CREATE OR REPLACE FUNCTION complete_daily_task(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_is_optional BOOLEAN;
  v_is_done BOOLEAN;
  v_points INTEGER;
  v_for_date DATE;
  v_new_score INTEGER;
  v_new_vitality INTEGER;
  v_tasks_done INTEGER;
  v_tasks_total INTEGER;
BEGIN
  -- 1. Get task details
  SELECT user_id, is_optional, done, for_date
  INTO v_user_id, v_is_optional, v_is_done, v_for_date
  FROM loop_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- If already done, just return current state (or we could handle toggle, but user requested 'complete')
  -- For this implementation, we'll assume it's a completion call.
  -- If we want to support toggle, we'd need a p_done parameter.
  IF v_is_done THEN
    SELECT cumulative_score, vitality INTO v_new_score, v_new_vitality FROM user_tree WHERE user_id = v_user_id;
    SELECT tasks_done, (SELECT count(*) FROM loop_tasks WHERE user_id = v_user_id AND for_date = v_for_date)
    INTO v_tasks_done, v_tasks_total FROM tree_daily_log WHERE user_id = v_user_id AND for_date = v_for_date;
    
    RETURN json_build_object(
      'status', 'already_done',
      'life_score', v_new_score,
      'vitality', v_new_vitality,
      'tasks_done', v_tasks_done,
      'tasks_total', v_tasks_total
    );
  END IF;

  -- 2. Update task
  UPDATE loop_tasks
  SET done = true,
      completed_at = now()
  WHERE id = p_task_id;

  -- 3. Calculate points
  v_points := CASE WHEN v_is_optional THEN 5 ELSE 10 END;

  -- 4. Update tree_daily_log
  INSERT INTO tree_daily_log (user_id, for_date, points, tasks_done)
  VALUES (v_user_id, v_for_date, v_points, 1)
  ON CONFLICT (user_id, for_date) DO UPDATE
  SET points = tree_daily_log.points + v_points,
      tasks_done = tree_daily_log.tasks_done + 1;

  -- 5. Update user_tree (cumulative score)
  INSERT INTO user_tree (user_id, cumulative_score, vitality)
  VALUES (v_user_id, v_points, 50)
  ON CONFLICT (user_id) DO UPDATE
  SET cumulative_score = user_tree.cumulative_score + v_points,
      updated_at = now();

  -- 6. Recalculate vitality
  -- We'll use the logic from calc_vitality(uid)
  v_new_vitality := calc_vitality(v_user_id);
  
  UPDATE user_tree
  SET vitality = v_new_vitality
  WHERE user_id = v_user_id
  RETURNING cumulative_score INTO v_new_score;

  -- 7. Get today's totals
  SELECT tasks_done, (SELECT count(*) FROM loop_tasks WHERE user_id = v_user_id AND for_date = v_for_date)
  INTO v_tasks_done, v_tasks_total
  FROM tree_daily_log
  WHERE user_id = v_user_id AND for_date = v_for_date;

  RETURN json_build_object(
    'status', 'success',
    'life_score', v_new_score,
    'vitality', v_new_vitality,
    'tasks_done', v_tasks_done,
    'tasks_total', v_tasks_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
