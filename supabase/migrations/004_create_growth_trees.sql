-- Migration: 004_create_growth_trees
-- Links to: Design Spec Section 4 (Growth Tree)
 
CREATE TABLE public.growth_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 
  -- Visual State (drives SVG rendering)
  branch_level INTEGER NOT NULL DEFAULT 0 CHECK (branch_level BETWEEN 0 AND 6),
  leaf_density REAL NOT NULL DEFAULT 0.0 CHECK (leaf_density BETWEEN 0.0 AND 1.0),
 
  -- Season (cycles every 30 days)
  season TEXT NOT NULL DEFAULT 'spring'
    CHECK (season IN ('spring','summer','autumn','winter')),
 
  -- Growth Points (internal scoring)
  total_growth_points REAL NOT NULL DEFAULT 0,
  weekly_growth_points REAL NOT NULL DEFAULT 0,
 
  -- Decay Tracking
  days_since_activity INTEGER NOT NULL DEFAULT 0,
  decay_applied BOOLEAN NOT NULL DEFAULT false,
 
  -- Milestones
  milestones_reached JSONB DEFAULT '[]'::jsonb,
 
  last_growth_event TIMESTAMPTZ
);
 
CREATE TRIGGER growth_trees_updated_at
  BEFORE UPDATE ON growth_trees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
 
ALTER TABLE growth_trees ENABLE ROW LEVEL SECURITY;
