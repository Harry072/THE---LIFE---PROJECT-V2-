-- Migration: 015_tree_growth
-- Tree Growth System: scoring tables + RPC functions
-- Links to: Tree Growth System Implementation Spec

-- ============================================================
-- 1. user_tree — one row per user (cumulative + vitality)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tree (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cumulative_score  INTEGER DEFAULT 0,
  vitality          INTEGER DEFAULT 50,   -- 0–100
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_tree ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_tree' AND policyname = 'tree_own'
  ) THEN
    CREATE POLICY "tree_own" ON user_tree
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 2. tree_daily_log — per-day point log (vitality + history)
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_daily_log (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  for_date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  points                   INTEGER DEFAULT 0,
  tasks_done               INTEGER DEFAULT 0,
  tasks_total              INTEGER DEFAULT 0,
  reflected                BOOLEAN DEFAULT false,
  all_tasks_bonus_awarded  BOOLEAN DEFAULT false,
  created_at               TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, for_date)
);

CREATE INDEX IF NOT EXISTS idx_tree_log_user
  ON tree_daily_log(user_id, for_date DESC);

ALTER TABLE tree_daily_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tree_daily_log' AND policyname = 'log_own'
  ) THEN
    CREATE POLICY "log_own" ON tree_daily_log
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 3. increment_tree_score — atomic upsert + increment
-- ============================================================
CREATE OR REPLACE FUNCTION increment_tree_score(
  uid UUID, pts INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO user_tree (user_id, cumulative_score)
  VALUES (uid, pts)
  ON CONFLICT (user_id) DO UPDATE
  SET cumulative_score = user_tree.cumulative_score + pts,
      updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. calc_vitality — 0–100 from last 7 days
-- ============================================================
CREATE OR REPLACE FUNCTION calc_vitality(uid UUID)
RETURNS INTEGER AS $$
DECLARE
  max_daily INTEGER := 66;
  total_pts INTEGER;
  days_active INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0), COUNT(*)
  INTO total_pts, days_active
  FROM tree_daily_log
  WHERE user_id = uid
    AND for_date >= CURRENT_DATE - INTERVAL '6 days';

  -- Vitality = (actual / theoretical max) * 100
  RETURN LEAST(100, ROUND(
    (total_pts::REAL / GREATEST(1, max_daily * 7)) * 100
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
