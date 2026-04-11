-- Migration: 001_create_profiles
-- Links to: Design Spec Section 2 (Onboarding / Challenge Navigator)
 
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 
  -- Struggle Profile (from Challenge Navigator cards)
  struggle_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
 
  -- Behavioral Profile (built invisibly from selections)
  struggle_cluster TEXT,  -- e.g., "dopamine-void", "spiral-alone", "drift"
 
  -- Engagement State
  streak_count INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  first_insight_seen BOOLEAN NOT NULL DEFAULT false,
 
  -- Preferences
  reflection_time TIME DEFAULT '21:00',  -- default 9pm
  timezone TEXT DEFAULT 'UTC',
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
 
  -- Community Access (earned, not given)
  can_read_community BOOLEAN NOT NULL DEFAULT false,   -- after first full loop
  can_post_community BOOLEAN NOT NULL DEFAULT false,   -- after 7-day engagement
  can_pair BOOLEAN NOT NULL DEFAULT false,             -- after 14-day engagement
 
  -- Mental Health
  distress_resource_shown BOOLEAN NOT NULL DEFAULT false,
  crisis_resources_dismissed_at TIMESTAMPTZ
);
 
-- Indexes
CREATE INDEX idx_profiles_struggle_cluster ON profiles(struggle_cluster);
CREATE INDEX idx_profiles_last_active ON profiles(last_active_at);
 
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
 
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
