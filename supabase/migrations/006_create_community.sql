-- Migration: 006_create_community
-- Links to: Design Spec Section 6 (Community / Belonging Layer)
 
CREATE TABLE public.community_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,      
  name TEXT NOT NULL,             
  description TEXT NOT NULL,
  struggle_tag TEXT NOT NULL,     
  member_count INTEGER NOT NULL DEFAULT 0,  
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- We link modules to community_rooms here to avoid order dependency issues
ALTER TABLE public.modules 
ADD COLUMN community_room_id UUID REFERENCES community_rooms(id);
 
CREATE TABLE public.room_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 2000),
  
  anonymous BOOLEAN NOT NULL DEFAULT true,
  anonymous_seed TEXT,  
  
  me_too_count INTEGER NOT NULL DEFAULT 0,  
  
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','flagged')),
  moderation_note TEXT,
  moderated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE public.me_too_taps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES room_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_me_too UNIQUE (post_id, user_id)
);
 
CREATE INDEX idx_posts_room_status ON room_posts(room_id, status, created_at DESC)
  WHERE status = 'approved';
CREATE INDEX idx_posts_moderation ON room_posts(status)
  WHERE status = 'pending';
CREATE INDEX idx_me_too_post ON me_too_taps(post_id);
 
CREATE OR REPLACE FUNCTION increment_me_too()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE room_posts SET me_too_count = me_too_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
CREATE TRIGGER on_me_too_insert
  AFTER INSERT ON me_too_taps
  FOR EACH ROW EXECUTE FUNCTION increment_me_too();
 
CREATE OR REPLACE FUNCTION decrement_me_too()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE room_posts SET me_too_count = GREATEST(0, me_too_count - 1)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
CREATE TRIGGER on_me_too_delete
  AFTER DELETE ON me_too_taps
  FOR EACH ROW EXECUTE FUNCTION decrement_me_too();
 
ALTER TABLE community_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE me_too_taps ENABLE ROW LEVEL SECURITY;
