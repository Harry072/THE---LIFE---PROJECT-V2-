-- ==========================================
-- Migration: 028_loop_tasks_core_uniqueness_all_sources
-- Goal: Prevent duplicate incomplete core loop tasks from any source.
--
-- Completed task history is left untouched. Existing duplicate incomplete
-- core rows are preserved as optional/skipped records so they no longer
-- participate in core scoring or violate the all-sources uniqueness guard.
-- ==========================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, for_date, lower(category)
      ORDER BY
        CASE
          WHEN NULLIF(trim(COALESCE(title, '')), '') IS NOT NULL
           AND NULLIF(trim(COALESCE(detail_description, '')), '') IS NOT NULL
          THEN 0
          ELSE 1
        END,
        CASE
          WHEN NULLIF(trim(COALESCE(title, '')), '') IS NOT NULL
          THEN 0
          ELSE 1
        END,
        created_at ASC NULLS LAST,
        id ASC
    ) AS duplicate_rank
  FROM public.loop_tasks
  WHERE COALESCE(is_optional, false) = false
    AND completed_at IS NULL
    AND lower(category) IN ('awareness', 'action', 'meaning')
)
UPDATE public.loop_tasks AS task
SET
  is_optional = true,
  skipped = true,
  sort_order = COALESCE(task.sort_order, 999) + 100
FROM ranked
WHERE task.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_unique_incomplete_core_all_sources
  ON public.loop_tasks(user_id, for_date, lower(category))
  WHERE COALESCE(is_optional, false) = false
    AND completed_at IS NULL
    AND lower(category) IN ('awareness', 'action', 'meaning');
