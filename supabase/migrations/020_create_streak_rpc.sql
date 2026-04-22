-- Migration: 020_create_streak_rpc
-- Purpose: Neutralized version for UI Unblocking. 
-- Statically returns 0 to avoid dependency on missing tables.

CREATE OR REPLACE FUNCTION get_user_streak(uid uuid)
RETURNS integer AS $$
BEGIN
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
