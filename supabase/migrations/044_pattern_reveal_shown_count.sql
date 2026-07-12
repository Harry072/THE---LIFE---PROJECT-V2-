-- Migration: 044_pattern_reveal_shown_count
-- Reflection Layer 4 (Pattern Reveal).
--
-- Observability counter — how many times the reveal has actually been
-- displayed to the user (incremented only when the CHECK endpoint returns
-- pending=true, i.e. a real display, not every check). The 3-day expiry
-- rule uses companion_context.date (already exists), not this column.
ALTER TABLE public.companion_context
  ADD COLUMN IF NOT EXISTS reveal_shown_count INT NOT NULL DEFAULT 0;
