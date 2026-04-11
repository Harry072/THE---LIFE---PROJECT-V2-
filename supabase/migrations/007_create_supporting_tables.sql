-- Migration: 007_create_supporting_tables
 
CREATE TABLE public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES room_posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'new_post',
  auto_flags JSONB DEFAULT '[]'::jsonb,  
  reviewer_notes TEXT,
  decided_at TIMESTAMPTZ,
  decision TEXT CHECK (decision IN ('approve','reject','flag')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  dedup_key TEXT,
  CONSTRAINT unique_dedup UNIQUE (user_id, dedup_key)
);
 
CREATE INDEX idx_notifications_user ON notification_log(user_id, sent_at DESC);
 
CREATE TABLE public.distress_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('onboarding','reflection','manual')),
  trigger_keywords JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('elevated','immediate')),
  reflection_id UUID REFERENCES reflections(id),
  resource_shown BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE public.insight_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL,
  headline TEXT NOT NULL,
  explanation TEXT NOT NULL,
  community_bridge TEXT NOT NULL DEFAULT 'You''re not the only one here who recognizes this.',
  active BOOLEAN NOT NULL DEFAULT true
);
 
CREATE INDEX idx_insight_cluster ON insight_templates(cluster_key)
  WHERE active = true;
 
CREATE TABLE public.reflection_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  weight REAL NOT NULL DEFAULT 1.0,
  active BOOLEAN NOT NULL DEFAULT true
);
 
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE distress_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_questions ENABLE ROW LEVEL SECURITY;
