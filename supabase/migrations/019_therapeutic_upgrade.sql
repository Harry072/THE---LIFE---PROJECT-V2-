-- PHASE 1: THE USER BEHAVIOR TABLE
CREATE TABLE IF NOT EXISTS public.user_behavior (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    core_struggles TEXT[],
    initial_energy TEXT,
    avg_completion_rate REAL DEFAULT 0.5,
    preferred_time TEXT DEFAULT 'morning',
    skipped_categories TEXT[],
    engaged_categories TEXT[],
    mood_trend TEXT[],
    avg_mood_score REAL DEFAULT 5,
    streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    total_reflections INTEGER DEFAULT 0,
    days_since_last_active INTEGER DEFAULT 0,
    why_button_clicks INTEGER DEFAULT 0,
    avg_time_to_complete REAL DEFAULT 0,
    therapeutic_mode TEXT DEFAULT 'standard',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.user_behavior ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY: behavior_own
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_behavior' AND policyname = 'behavior_own'
    ) THEN
        CREATE POLICY "behavior_own" ON public.user_behavior
          FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- PHASE 2: UPGRADE THE LOOP_TASKS TABLE
-- Using ADD COLUMN IF NOT EXISTS for safety
ALTER TABLE public.loop_tasks 
    ADD COLUMN IF NOT EXISTS framework TEXT,
    ADD COLUMN IF NOT EXISTS addresses TEXT,
    ADD COLUMN IF NOT EXISTS completion_insight TEXT,
    ADD COLUMN IF NOT EXISTS difficulty_tag TEXT,
    ADD COLUMN IF NOT EXISTS detail_title TEXT,
    ADD COLUMN IF NOT EXISTS detail_description TEXT,
    ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT true;
