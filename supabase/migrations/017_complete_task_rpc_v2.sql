-- Migration: 017_complete_task_rpc_v2
-- Atomic task completion and metrics update, targeting `tasks` table and `user_tree.vitality`

CREATE OR REPLACE FUNCTION complete_daily_task_v2(p_task_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_domain TEXT;
  v_is_done BOOLEAN;
  v_points INTEGER;
  v_assigned_date DATE;
  v_new_score INTEGER;
  v_new_vitality INTEGER;
  v_tasks_done INTEGER;
  v_tasks_total INTEGER;
BEGIN
  -- 1. Get task details from the master `tasks` table
  SELECT user_id, domain, (completed_at IS NOT NULL) as done, assigned_date
  INTO v_user_id, v_domain, v_is_done, v_assigned_date
  FROM tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- 2. Prevent duplicate completions
  IF v_is_done THEN
    SELECT cumulative_score, vitality INTO v_new_score, v_new_vitality FROM user_tree WHERE user_id = v_user_id;
    SELECT tasks_done, tasks_total INTO v_tasks_done, v_tasks_total 
    FROM tree_daily_log 
    WHERE user_id = v_user_id AND for_date = v_assigned_date;
    
    RETURN json_build_object(
      'status', 'already_done',
      'life_score', v_new_score,
      'vitality', v_new_vitality,
      'tasks_done', COALESCE(v_tasks_done, 0),
      'tasks_total', COALESCE(v_tasks_total, 0)
    );
  END IF;

  -- 3. Update task
  UPDATE tasks
  SET completed_at = now()
  WHERE id = p_task_id;

  -- 4. Calculate points (e.g. Action=10, Awareness=5, Meaning=5 for simplicity, or 10 for all)
  -- We'll use 10 for all core tasks
  v_points := 10;

  -- 5. Update tree_daily_log
  -- We ensure a row exists for today
  INSERT INTO tree_daily_log (user_id, for_date, points, tasks_done, tasks_total)
  VALUES (v_user_id, v_assigned_date, v_points, 1, (SELECT COUNT(*) FROM tasks WHERE user_id = v_user_id AND assigned_date = v_assigned_date))
  ON CONFLICT (user_id, for_date) DO UPDATE
  SET points = tree_daily_log.points + v_points,
      tasks_done = tree_daily_log.tasks_done + 1;

  -- 6. Update user_tree (cumulative score)
  INSERT INTO user_tree (user_id, cumulative_score, vitality)
  VALUES (v_user_id, v_points, 50)
  ON CONFLICT (user_id) DO UPDATE
  SET cumulative_score = user_tree.cumulative_score + v_points,
      updated_at = now();

  -- 7. Recalculate vitality
  -- We'll use the existing logic from calc_vitality(uid)
  v_new_vitality := calc_vitality(v_user_id);
  
  UPDATE user_tree
  SET vitality = v_new_vitality
  WHERE user_id = v_user_id
  RETURNING cumulative_score INTO v_new_score;

  -- 8. Get today's totals
  SELECT tasks_done, tasks_total
  INTO v_tasks_done, v_tasks_total
  FROM tree_daily_log
  WHERE user_id = v_user_id AND for_date = v_assigned_date;

  RETURN json_build_object(
    'status', 'success',
    'life_score', v_new_score,
    'vitality', v_new_vitality,
    'tasks_done', COALESCE(v_tasks_done, 1),
    'tasks_total', COALESCE(v_tasks_total, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
