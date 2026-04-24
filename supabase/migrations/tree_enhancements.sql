ALTER TABLE IF EXISTS public.user_tree
  ADD COLUMN IF NOT EXISTS cumulative_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vitality INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION public.calc_vitality(uid UUID)
RETURNS INTEGER AS $$
DECLARE
  total_pts INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((to_jsonb(t)->>'done')::BOOLEAN, t.completed_at IS NOT NULL) THEN
        CASE
          WHEN COALESCE((to_jsonb(t)->>'is_optional')::BOOLEAN, false) THEN 5
          ELSE 10
        END
      ELSE 0
    END
  ), 0)
  INTO total_pts
  FROM public.loop_tasks AS t
  WHERE t.user_id = uid
    AND t.for_date >= CURRENT_DATE - INTERVAL '6 days';

  RETURN LEAST(100, GREATEST(0, ROUND(
    (total_pts::REAL / GREATEST(1, 7 * 35)) * 100
  )::INTEGER));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.increment_tree_score(uid UUID, pts INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_tree (
    user_id,
    cumulative_score,
    vitality,
    streak,
    updated_at
  )
  VALUES (
    uid,
    GREATEST(0, COALESCE(pts, 0)),
    50,
    0,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET cumulative_score = GREATEST(
        0,
        COALESCE(public.user_tree.cumulative_score, 0) + COALESCE(pts, 0)
      ),
      updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
