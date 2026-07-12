-- ============================================================
-- Migration: 045_growth_tree_security
-- Growth Tree production rebuild — Step 0 security fixes.
--
-- Ground-truth confirmed live (2026-07-11, user-run queries):
--   • live complete_loop_task_v4 = the 033 body → F8 live:
--     every completion currently awards 0 points (generator
--     writes is_optional=true; 033 requires is_optional=false)
--   • public.increment_tree_score(uuid, integer) EXISTS live
--   • FOR ALL client policies live on user_tree,
--     tree_daily_log, user_behavior
--
-- Approved corrections applied:
--   • v_is_core := true unconditionally — ownership +
--     idempotency make an owned, first-time completion
--     legitimate; is_optional was a generator implementation
--     detail and no longer participates in scoring anywhere.
--   • Req 4 hard cap re-scoped INTO this migration (it was
--     deferred on the belief idempotency structurally bounds
--     daily events — that belief broke when loop_tasks was
--     confirmed client-insertable: policy "loop_own" FOR ALL,
--     012_loop_tasks.sql:36-37, and seedNewUser.js:24 is a
--     legitimate client INSERT we cannot revoke). A constant
--     server-side cap bounds fabricated-task farming at
--     ~100 pts/day instead of unlimited. Legitimate maximum
--     is 4 events/day (2 tasks + 2 bonuses); cap = 10 leaves
--     headroom for legacy 5-task days.
--
-- Order matters. Backdoor first.
-- ============================================================

-- 1. BACKDOOR ELIMINATED FIRST — SECURITY DEFINER, no auth
--    check, arbitrary user_id + arbitrary points, zero app
--    callers. Confirmed live by Query 2.
DROP FUNCTION IF EXISTS public.increment_tree_score(uuid, integer);

-- 2. Score tables: clients become read-only. The only writers
--    are the SECURITY DEFINER RPC below and the backend service
--    role (both bypass RLS). With no INSERT/UPDATE/DELETE
--    policy, those verbs are denied by default under RLS.
DROP POLICY IF EXISTS "tree_own" ON public.user_tree;
CREATE POLICY "tree_own_select" ON public.user_tree
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "log_own" ON public.tree_daily_log;
CREATE POLICY "log_own_select" ON public.tree_daily_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "behavior_own" ON public.user_behavior;
CREATE POLICY "behavior_own_select" ON public.user_behavior
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Audit trail — one row per score event. Source of truth for
--    disputes and the Tree Memory timeline. Deny-all for
--    clients (RLS enabled, zero policies) — written only inside
--    the SECURITY DEFINER RPC, read only by the backend service
--    role. Same posture as companion_context / escalation_log.
CREATE TABLE IF NOT EXISTS public.tree_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN
    ('task_completion', 'all_tasks_bonus', 'streak_bonus')),
  task_id UUID,
  points_delta INTEGER NOT NULL,
  running_total INTEGER NOT NULL,
  for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tree_score_events_user_date
  ON public.tree_score_events (user_id, for_date);
CREATE INDEX IF NOT EXISTS idx_tree_score_events_user_created
  ON public.tree_score_events (user_id, created_at DESC);

ALTER TABLE public.tree_score_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny-all for clients, service role only.

-- 4. Canonical scoring RPC. Body = live 033 with the approved
--    changes and nothing else:
--      CORRECTION — v_is_core := true (ownership + idempotency
--                   are the gates; is_optional removed from the
--                   RPC entirely)
--      FIX B      — tree_score_events insert per award type
--      FIX C      — all-tasks bonus counts today's REAL rows
--                   (with 2 generated tasks/day, the old
--                   "3 distinct categories" rule could never
--                   fire, and the 40/day vitality max below
--                   assumes the bonus is reachable)
--      REQ 4 CAP  — constant daily event cap (see header)
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
  v_events_today INTEGER := 0;
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
  SELECT * INTO v_task
  FROM public.loop_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', p_task_id;
  END IF;

  -- User isolation: the caller must own this task.
  IF auth.uid() IS NULL OR v_task.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to complete this task';
  END IF;

  v_user_id := v_task.user_id;
  v_for_date := v_task.for_date;

  -- CORRECTION: an owned, not-yet-completed task is legitimate.
  -- Ownership (above) + idempotency (below) are the gates.
  v_is_core := true;

  INSERT INTO public.user_tree (user_id, cumulative_score, vitality, streak, updated_at)
  VALUES (v_user_id, 0, 50, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.tree_daily_log (user_id, for_date, points, tasks_done, tasks_total, all_tasks_bonus_awarded, streak_bonus_awarded)
  VALUES (v_user_id, v_for_date, 0, 0, 0, false, false)
  ON CONFLICT (user_id, for_date) DO NOTHING;

  SELECT COALESCE(cumulative_score, 0), COALESCE(streak, 0), last_completed_date
  INTO v_current_score, v_current_streak, v_last_completed_date
  FROM public.user_tree
  WHERE user_id = v_user_id
  FOR UPDATE;

  SELECT COALESCE(all_tasks_bonus_awarded, false), COALESCE(streak_bonus_awarded, false)
  INTO v_all_bonus_awarded, v_streak_bonus_awarded
  FROM public.tree_daily_log
  WHERE user_id = v_user_id AND for_date = v_for_date
  FOR UPDATE;

  -- Idempotency: only a first-time completion can award points.
  IF v_task.completed_at IS NULL THEN
    UPDATE public.loop_tasks AS task
    SET completed_at = now(), done = true
    WHERE task.id = p_task_id AND task.completed_at IS NULL
    RETURNING row_to_json(task.*) INTO v_updated_task_json;

    IF v_updated_task_json IS NULL THEN
      SELECT row_to_json(t.*) INTO v_updated_task_json
      FROM public.loop_tasks AS t WHERE t.id = p_task_id;
    END IF;

    IF v_is_core THEN
      v_base_points := 10;
    END IF;
  ELSE
    SELECT row_to_json(t.*) INTO v_updated_task_json
    FROM public.loop_tasks AS t WHERE t.id = p_task_id;
  END IF;

  -- REQ 4 hard cap: bounded score events per user per day.
  -- loop_tasks is client-insertable (policy "loop_own" FOR ALL),
  -- so tasks_today is not a trustworthy bound — a constant is.
  -- Legitimate day = at most 4 events; cap 10 leaves headroom.
  SELECT COUNT(*) INTO v_events_today
  FROM public.tree_score_events
  WHERE user_id = v_user_id AND for_date = v_for_date;

  IF v_base_points > 0 AND v_events_today >= 10 THEN
    RAISE LOG 'TREE_SCORE daily_cap_exceeded user=% date=% events=%',
      v_user_id, v_for_date, v_events_today;
    v_base_points := 0;
  END IF;

  -- FIX C: completion state from today's real rows.
  SELECT
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL),
    COUNT(*)
  INTO v_completed_core_count, v_core_total
  FROM public.loop_tasks
  WHERE user_id = v_user_id
    AND for_date = v_for_date
    AND category IN ('awareness', 'action', 'meaning');

  v_all_tasks_complete := v_core_total > 0
    AND v_completed_core_count >= v_core_total;

  -- All-tasks completion bonus (once per day).
  IF v_base_points > 0 AND v_all_tasks_complete AND NOT v_all_bonus_awarded THEN
    v_bonus_points := 15;
    v_all_bonus_awarded := true;
  END IF;

  -- Streak logic — only moves on real day boundaries.
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
  WHERE user_id = v_user_id AND for_date = v_for_date;

  v_new_vitality := public.calc_vitality(v_user_id);
  v_new_score := v_current_score + v_awarded_points;

  -- FIX B: audit trail — one row per award type, cumulative
  -- running_total in insert order.
  IF v_base_points > 0 THEN
    INSERT INTO public.tree_score_events
      (user_id, event_type, task_id, points_delta, running_total, for_date)
    VALUES
      (v_user_id, 'task_completion', p_task_id, v_base_points,
       v_current_score + v_base_points, v_for_date);
  END IF;

  IF v_bonus_points > 0 THEN
    INSERT INTO public.tree_score_events
      (user_id, event_type, task_id, points_delta, running_total, for_date)
    VALUES
      (v_user_id, 'all_tasks_bonus', NULL, v_bonus_points,
       v_current_score + v_base_points + v_bonus_points, v_for_date);
  END IF;

  IF v_streak_bonus_points > 0 THEN
    INSERT INTO public.tree_score_events
      (user_id, event_type, task_id, points_delta, running_total, for_date)
    VALUES
      (v_user_id, 'streak_bonus', NULL, v_streak_bonus_points,
       v_new_score, v_for_date);
  END IF;

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

  -- Lifetime total for user_behavior (all owned completions).
  SELECT COUNT(*)
  INTO v_total_tasks_completed
  FROM public.loop_tasks
  WHERE user_id = v_user_id
    AND category IN ('awareness', 'action', 'meaning')
    AND completed_at IS NOT NULL;

  INSERT INTO public.user_behavior (
    user_id, streak, longest_streak, total_tasks_completed,
    avg_completion_rate, updated_at
  )
  VALUES (
    v_user_id, v_new_streak, v_new_streak, v_total_tasks_completed,
    LEAST(1, v_completed_core_count::REAL / GREATEST(1, v_core_total)),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET streak = v_new_streak,
      longest_streak = GREATEST(COALESCE(public.user_behavior.longest_streak, 0), v_new_streak),
      total_tasks_completed = v_total_tasks_completed,
      avg_completion_rate = LEAST(1, v_completed_core_count::REAL / GREATEST(1, v_core_total)),
      updated_at = now();

  RETURN json_build_object(
    'status',                    CASE WHEN v_awarded_points > 0 THEN 'success' ELSE 'already_completed' END,
    'task',                      v_updated_task_json,
    'new_vitality',              v_new_vitality,
    'new_total_completed_today', v_completed_core_count,
    'today_tasks_total',         v_core_total,
    'new_streak',                v_new_streak,
    'new_score',                 v_new_score,
    'awarded_points',            v_awarded_points,
    'all_tasks_complete',        v_all_tasks_complete
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Vitality denominator matches the fixed scoring:
--    2 tasks × 10 + 15 all-tasks + 5 streak = 40/day maximum.
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
    (total_pts::REAL / GREATEST(1, 7 * 40)) * 100
  )::INTEGER));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Post-apply verification — run each, expected results:
--
-- 1) Backdoor gone (expect ZERO rows):
--    SELECT proname FROM pg_proc WHERE proname = 'increment_tree_score';
--
-- 2) Only SELECT policies remain on the three score tables
--    (expect exactly three rows, cmd = SELECT):
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('user_tree','tree_daily_log','user_behavior');
--
-- 3) Audit table exists with RLS on and zero policies
--    (expect relrowsecurity = true; second query zero rows):
--    SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname = 'tree_score_events';
--    SELECT policyname FROM pg_policies
--    WHERE tablename = 'tree_score_events';
--
-- 4) Client write really denied (run as an authenticated user
--    in the app, or via the SQL editor's impersonation):
--    UPDATE public.user_tree SET cumulative_score = 999999;
--    -- expect: 0 rows updated
-- ============================================================
