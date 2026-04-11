-- Migration: 008_rls_policies
 
-- profiles
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
 
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- tasks
CREATE POLICY "Users read own tasks"
  ON tasks FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
 
CREATE POLICY "Users update own tasks"
  ON tasks FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- reflections
CREATE POLICY "Users read own reflections"
  ON reflections FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
 
CREATE POLICY "Users insert own reflections"
  ON reflections FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- growth_trees
CREATE POLICY "Own tree" ON growth_trees FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Own tree update" ON growth_trees FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- community
CREATE POLICY "Community readers see rooms"
  ON community_rooms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND can_read_community = true
    )
  );

CREATE POLICY "Read approved posts"
  ON room_posts FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND can_read_community = true
    )
  );

CREATE POLICY "Users create posts"
  ON room_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND can_post_community = true
    )
  );

CREATE POLICY "Users tap me too"
  ON me_too_taps FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND can_read_community = true
    )
  );

CREATE POLICY "Users read own taps"
  ON me_too_taps FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users delete own taps"
  ON me_too_taps FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- modules
CREATE POLICY "Read modules" ON modules FOR SELECT TO authenticated
  USING (active = true);
 
CREATE POLICY "Own modules" ON user_modules FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
 
-- notifications
CREATE POLICY "Own notifications" ON notification_log FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Mark read" ON notification_log FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- insights & questions
CREATE POLICY "Read insights" ON insight_templates FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Read questions" ON reflection_questions FOR SELECT TO authenticated
  USING (active = true);
