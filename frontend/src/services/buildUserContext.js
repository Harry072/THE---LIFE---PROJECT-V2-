import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";

export async function buildUserContext(userId) {
  // If no real UUID (demo mode), return context from Zustand store
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
  
  if (!isUUID) {
    // CRITICAL: Pull struggle_profile from the Zustand store so user selections flow through
    const profile = useUserStore.getState().profile;
    return {
      onboarding: {},
      struggle_profile: profile?.struggle_tags || [],
      reflections: [],
      yesterdayTasks: [],
      completionRate: 50,
      streak: 0,
      moods: [],
      skippedCategories: [],
      recentTitles: [],
    };
  }

  // Last 3 reflections, safe metadata only. Do not select or return raw answers.
  let reflections = [];
  try {
    const { data } = await supabase
      .from("reflections")
      .select("for_date, mood, pattern_tags")
      .eq("user_id", userId)
      .order("for_date", { ascending: false })
      .limit(3);
    reflections = data || [];
  } catch (e) {
    console.warn("Reflections table missing or inaccessible:", e);
  }

  // Yesterday's tasks
  let yesterdayTasks = [];
  try {
    const { data } = await supabase
      .from("loop_tasks")
      .select("title, category, done, skipped")
      .eq("user_id", userId);
    yesterdayTasks = data || [];
  } catch (e) {
    console.warn("Loop_tasks table missing or inaccessible (yesterdayTasks):", e);
  }

  // 7-day completion rate
  let completionRate = 50;
  try {
    const { data: weekTasks } = await supabase
      .from("loop_tasks")
      .select("done")
      .eq("user_id", userId)
      .eq("is_optional", false);

    const total = weekTasks?.length || 0;
    const completed = weekTasks?.filter(t => t.done).length || 0;
    completionRate = total > 0
      ? Math.round((completed / total) * 100) : 50;
  } catch (e) {
    console.warn("Loop_tasks table missing or inaccessible (completionRate):", e);
  }

  // Streak (RPC Neutralized)
  let streak = 0;
  try {
    const { data: streakData } = await supabase
      .rpc("get_user_streak", { uid: userId });
    streak = streakData || 0;
  } catch (e) {
    console.warn("Streak RPC failed during context build", e);
    streak = 0;
  }

  // Fetch explicit struggles (Bypassing missing profiles table)
  const struggle_profile = []; 

  // user_context table was never created — use empty defaults.
  const onboardingProfile = null;

  // Mood trend from safe mood labels or pattern_tags.
  const moods = (reflections || [])
    .map(r => r.mood || r.pattern_tags?.[0])
    .filter(Boolean);

  // Recent titles (for no-repeat check)
  let recentTitles = [];
  try {
    const { data: recentTasks } = await supabase
      .from("loop_tasks")
      .select("title")
      .eq("user_id", userId);
    recentTitles = (recentTasks || []).map(t => t.title);
  } catch (e) {
    console.warn("Loop_tasks table missing or inaccessible (recentTitles):", e);
  }

  return {
    onboarding: onboardingProfile?.onboarding || {},
    struggle_profile: struggle_profile || [],
    reflections: (reflections || []).map(r => ({
      date: r.for_date,
      mood: r.mood || null,
      pattern_tags: Array.isArray(r.pattern_tags) ? r.pattern_tags : [],
    })),
    yesterdayTasks: (yesterdayTasks || []).map(t => ({
      title: t.title,
      category: t.category,
      completed: t.done,
      skipped: t.skipped,
    })),
    completionRate,
    streak,
    moods,
    skippedCategories: onboardingProfile?.skipped_categories || [],
    recentTitles,
  };
}
