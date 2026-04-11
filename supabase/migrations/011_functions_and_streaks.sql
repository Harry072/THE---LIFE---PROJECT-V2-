-- Migration: 011_functions_and_streaks
 
CREATE OR REPLACE FUNCTION route_user_to_rooms()
RETURNS TRIGGER AS $$
DECLARE
  tag TEXT;
BEGIN
  IF NEW.onboarding_completed = true AND OLD.onboarding_completed = false THEN
    FOR tag IN SELECT jsonb_array_elements_text(NEW.struggle_tags)
    LOOP
      UPDATE community_rooms
      SET member_count = member_count + 1
      WHERE struggle_tag = tag;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
CREATE TRIGGER on_onboarding_complete
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION route_user_to_rooms();

CREATE OR REPLACE FUNCTION calculate_daily_streaks()
RETURNS void AS $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT p.id, p.streak_count, p.longest_streak,
           p.last_active_at, p.can_read_community, p.can_post_community
    FROM profiles p
    WHERE p.onboarding_completed = true
  LOOP
    DECLARE
      tasks_done INTEGER;
      reflected BOOLEAN;
      new_streak INTEGER;
    BEGIN
      SELECT COUNT(*) INTO tasks_done
      FROM tasks
      WHERE user_id = u.id
        AND assigned_date = CURRENT_DATE
        AND completed_at IS NOT NULL;
 
      SELECT EXISTS(
        SELECT 1 FROM reflections
        WHERE user_id = u.id AND reflection_date = CURRENT_DATE
      ) INTO reflected;
 
      IF tasks_done >= 2 AND reflected THEN
        new_streak := u.streak_count + 1;
        UPDATE profiles SET
          streak_count = new_streak,
          longest_streak = GREATEST(u.longest_streak, new_streak),
          last_active_at = now(),
          can_read_community = CASE WHEN new_streak >= 1 THEN true ELSE u.can_read_community END,
          can_post_community = CASE WHEN new_streak >= 7 THEN true ELSE u.can_post_community END,
          can_pair = CASE WHEN new_streak >= 14 THEN true ELSE u.can_pair END
        WHERE id = u.id;
      ELSIF u.last_active_at < now() - interval '48 hours' THEN
        UPDATE profiles SET
          last_active_at = now()
        WHERE id = u.id;
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auto_moderate_post()
RETURNS TRIGGER AS $$
DECLARE
  flags JSONB := '[]'::jsonb;
  content_lower TEXT := lower(NEW.content);
BEGIN
  IF content_lower ~ '(you should|you need to|just try|have you tried)' THEN
    flags := flags || '"unsolicited_advice"'::jsonb;
  END IF;
  IF content_lower ~ '(at least you|others have it worse|be grateful)' THEN
    flags := flags || '"toxic_positivity"'::jsonb;
  END IF;
  IF content_lower ~ '(i did \d+ days|my streak is|i''m ahead)' THEN
    flags := flags || '"comparison"'::jsonb;
  END IF;
 
  INSERT INTO moderation_queue (post_id, auto_flags)
  VALUES (NEW.id, flags);
 
  IF jsonb_array_length(flags) = 0 AND char_length(NEW.content) BETWEEN 10 AND 500 THEN
    UPDATE room_posts SET status = 'approved' WHERE id = NEW.id;
    UPDATE moderation_queue SET decision = 'approve', decided_at = now()
    WHERE post_id = NEW.id;
  END IF;
 
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
CREATE TRIGGER on_post_created
  AFTER INSERT ON room_posts
  FOR EACH ROW EXECUTE FUNCTION auto_moderate_post();
