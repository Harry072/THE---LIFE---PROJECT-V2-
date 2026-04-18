-- Daily generated tasks
CREATE TABLE IF NOT EXISTS loop_tasks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  for_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  category        TEXT NOT NULL,
  why             TEXT,
  duration_minutes INTEGER DEFAULT 15,
  preferred_time  TEXT DEFAULT 'morning',
  intensity       TEXT DEFAULT 'medium',
  is_optional     BOOLEAN DEFAULT false,
  done            BOOLEAN DEFAULT false,
  completed_at    TIMESTAMPTZ,
  skipped         BOOLEAN DEFAULT false,
  ai_generated    BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_loop_user_date
    ON loop_tasks(user_id, for_date DESC);

-- Enable RLS
ALTER TABLE loop_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit their own tasks
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'loop_tasks' AND policyname = 'loop_own'
    ) THEN
        CREATE POLICY "loop_own" ON loop_tasks
          FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- User context snapshot (cached daily for AI prompt)
CREATE TABLE IF NOT EXISTS user_context (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  onboarding      JSONB,        -- original onboarding answers
  streak          INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0,  -- 0.0 – 1.0
  mood_trend      TEXT[],        -- last 5 mood tags
  skipped_categories TEXT[],     -- categories user tends to skip
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit their own context
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_context' AND policyname = 'ctx_own'
    ) THEN
        CREATE POLICY "ctx_own" ON user_context
          FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
