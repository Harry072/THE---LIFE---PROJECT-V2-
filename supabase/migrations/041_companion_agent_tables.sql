-- Migration: 041_companion_agent_tables
-- Companion Expert Agent — Step 2 (tools) and Step 5 (orchestrator feed).
--
-- Two new tables, both written ONLY by the backend service role.
-- RLS is enabled with NO client policies: authenticated users get no direct
-- access at all (the service role bypasses RLS). Escalation audit rows and
-- orchestrator signals are internal — the frontend never reads them directly.

-- ── escalation_log ───────────────────────────────────────────────────────────
-- Audit trail for every distress escalation the companion serves.
-- message_snippet is hard-capped at 50 chars AT THE COLUMN LEVEL so a code bug
-- can never write full message text into the audit log (data minimization).

CREATE TABLE public.escalation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signal_type TEXT NOT NULL CHECK (
    signal_type IN ('crisis', 'persistent_distress', 'self_harm_adjacent')
  ),
  message_snippet VARCHAR(50),
  response_served TEXT NOT NULL
);

CREATE INDEX idx_escalation_log_user_time
  ON public.escalation_log (user_id, created_at DESC);

ALTER TABLE public.escalation_log ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny-all for clients, service role only.

-- ── companion_context ────────────────────────────────────────────────────────
-- The orchestrator feed: one row per user per day, upserted by the companion
-- after each session turn (Step 7 of the ReAct loop). Read later by the task
-- agent and orchestrator — never by the frontend directly.

CREATE TABLE public.companion_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  primary_emotion TEXT,
  energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high')),
  pattern_detected BOOLEAN NOT NULL DEFAULT false,
  pattern_summary TEXT,
  session_quality TEXT CHECK (session_quality IN ('deep', 'surface', 'crisis')),
  task_recommendation TEXT,
  escalation_triggered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per user per day; the backend upserts on this pair.
CREATE UNIQUE INDEX idx_companion_context_user_date
  ON public.companion_context (user_id, date);

ALTER TABLE public.companion_context ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny-all for clients, service role only.
