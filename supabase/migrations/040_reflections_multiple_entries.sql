-- Migration: 040_reflections_multiple_entries
-- Layer 1 of the Reflection Agent + Journal feature.
--
-- Allows multiple journal entries per user per day, and adds a free-form
-- `content` column for entries going forward. Existing rows and their
-- `questions` JSONB (the old 3-fixed-prompt format) are left completely
-- untouched -- nothing is migrated backward, nothing is deleted.

-- Drop the one-row-per-day constraint. distress_flags.reflection_id
-- references reflections(id) (the primary key), not this composite index,
-- so dropping it is safe.
DROP INDEX IF EXISTS idx_reflections_unique_daily;

-- Free-form entry text going forward. Nullable so existing rows (which use
-- `questions` instead) are unaffected.
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS content TEXT;

-- Non-unique index to support per-day grouping and newest-first ordering
-- now that a user can have many rows for the same for_date.
CREATE INDEX IF NOT EXISTS idx_reflections_user_date_created
  ON public.reflections (user_id, for_date, created_at DESC);
