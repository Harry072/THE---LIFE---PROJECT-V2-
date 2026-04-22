-- REVISED SCHEMA REPAIR (PHASE 3)
-- Strictly creates missing tables and policies.

-- 1. Ensure user_context table exists
CREATE TABLE IF NOT EXISTS public.user_context (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    onboarding JSONB DEFAULT '{}'::jsonb,
    streak INTEGER DEFAULT 0,
    completion_rate REAL DEFAULT 0,
    mood_trend TEXT[] DEFAULT '{}'::text[],
    skipped_categories TEXT[] DEFAULT '{}'::text[],
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ensure reflections table exists
CREATE TABLE IF NOT EXISTS public.reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    pattern_tags JSONB DEFAULT '[]'::jsonb,
    sentiment_score REAL,
    insight_text TEXT
);

-- 3. Enable RLS
ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

-- 4. Add owner-only policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_context' AND policyname = 'user_context_owner') THEN
        CREATE POLICY "user_context_owner" ON public.user_context FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reflections' AND policyname = 'reflections_owner') THEN
        CREATE POLICY "reflections_owner" ON public.reflections FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
