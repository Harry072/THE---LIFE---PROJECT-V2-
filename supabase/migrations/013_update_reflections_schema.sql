-- Update reflections table to match latest feature spec
-- 1. Rename columns for clarity as per Night Reflection spec
-- 2. Add mood column
-- 3. Ensure unique constraint for one reflection per day

DO $$ 
BEGIN
    -- Rename reflection_date to for_date if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reflections' AND column_name='reflection_date') THEN
        ALTER TABLE public.reflections RENAME COLUMN reflection_date TO for_date;
    END IF;

    -- Rename answers to questions if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reflections' AND column_name='answers') THEN
        ALTER TABLE public.reflections RENAME COLUMN answers TO questions;
    END IF;

    -- Add mood column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reflections' AND column_name='mood') THEN
        ALTER TABLE public.reflections ADD COLUMN mood TEXT;
    END IF;

    -- Update user_id to point to auth.users if needed, but existing migration 003 used profiles(id).
    -- We will keep it pointing to profiles(id) as it's the standard for this app.
END $$;

-- Ensure indexes are correct
DROP INDEX IF EXISTS idx_reflections_unique_daily;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reflections_unique_daily ON reflections(user_id, for_date);

-- Ensure RLS is enabled and accessible
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reflections_own" ON reflections;
CREATE POLICY "reflections_own" ON reflections
  FOR ALL USING (auth.uid() = user_id);
