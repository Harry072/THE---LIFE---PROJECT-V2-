-- ==========================================
-- Migration: 022_loop_stats_tracking
-- Goal: Track generation frequency and limits
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_loop_stats (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    last_generated_at TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '2 days'), -- Force 1st load
    daily_regenerate_count INTEGER DEFAULT 0,
    daily_growth_insight TEXT DEFAULT 'Starting your journey.',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS
ALTER TABLE public.user_loop_stats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_loop_stats' AND policyname = 'user_loop_stats_own'
    ) THEN
        CREATE POLICY "user_loop_stats_own" ON public.user_loop_stats
          FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
