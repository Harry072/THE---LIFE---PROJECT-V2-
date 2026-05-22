-- Companion session state persistence.
-- Stores per-user per-session emotional lock, refused features, and turn count.
CREATE TABLE IF NOT EXISTS public.companion_sessions (
    id TEXT PRIMARY KEY,
    state JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current on every write.
CREATE OR REPLACE FUNCTION public.set_companion_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companion_sessions_updated_at ON public.companion_sessions;
CREATE TRIGGER trg_companion_sessions_updated_at
    BEFORE UPDATE ON public.companion_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_companion_sessions_updated_at();
