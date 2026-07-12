-- Migration: 043_reflection_analysis
-- Reflection Layer 3 (Analysis Agent).
--
-- Two additive columns, nothing dropped, nothing rewritten. Both use
-- IF NOT EXISTS so re-running is harmless.

-- The analysis lives ON the entry it analysed. JSONB shape (written only by
-- the backend service role):
--   { primary_emotion, energy_level, signal, what_avoided, key_themes,
--     pattern_detected, pattern_description, pattern_frequency,
--     analysis_blocked, analysed_at }
-- Distress entries store only { signal_type, analysis_blocked: true,
-- analysed_at } — a distress entry is never analysed for patterns.
ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS reflection_analysis JSONB;

-- The Layer 4 handshake: Layer 3 only ever sets this TRUE (when a real
-- pattern with frequency >= 2 and similarity > 0.3 is confirmed).
-- Layer 4 reads it after task completion and clears it after the reveal.
-- NOT NULL so Layer 4 never has to distinguish null from false.
ALTER TABLE public.companion_context
  ADD COLUMN IF NOT EXISTS pattern_reveal_pending BOOLEAN NOT NULL DEFAULT false;
