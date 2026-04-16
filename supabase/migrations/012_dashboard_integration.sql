-- Migration: 012_dashboard_integration
-- Adds tables needed for dashboard wiring: focus_sessions, reading_list
-- Also adds get_user_streak() RPC for dashboard stat cards
-- NOTE: tasks and reflections tables already exist (002, 003) — NOT touched here

-- 1. Focus sessions
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duration_seconds  INTEGER NOT NULL,
  completed         BOOLEAN DEFAULT false,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_user_date
  ON focus_sessions(user_id, started_at DESC);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focus_own" ON focus_sessions;
CREATE POLICY "focus_own" ON focus_sessions
  FOR ALL USING (auth.uid() = user_id);


-- 2. Reading list
CREATE TABLE IF NOT EXISTS public.reading_list (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id    TEXT NOT NULL,
  added_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, book_id)
);

ALTER TABLE reading_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reading_own" ON reading_list;
CREATE POLICY "reading_own" ON reading_list
  FOR ALL USING (auth.uid() = user_id);


-- 3. get_user_streak RPC
-- Counts consecutive days (from today backwards) where user completed at least 1 task
CREATE OR REPLACE FUNCTION get_user_streak(uid UUID)
RETURNS INTEGER AS $$
DECLARE
  streak_count INTEGER := 0;
  check_date   DATE := CURRENT_DATE;
  has_activity BOOLEAN;
BEGIN
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM tasks
      WHERE user_id = uid
        AND assigned_date = check_date
        AND completed_at IS NOT NULL
    ) INTO has_activity;

    IF NOT has_activity THEN
      EXIT;
    END IF;

    streak_count := streak_count + 1;
    check_date := check_date - INTERVAL '1 day';
  END LOOP;

  RETURN streak_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
