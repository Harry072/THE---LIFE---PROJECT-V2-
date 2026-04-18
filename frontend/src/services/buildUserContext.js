import { supabase } from "../lib/supabase";

export async function buildUserContext(userId) {
  // If no real UUID (demo mode), return empty/default context immediately
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
  
  if (!isUUID) {
    return {
      onboarding: {},
      reflections: [],
      yesterdayTasks: [],
      completionRate: 50,
      streak: 0,
      moods: [],
      skippedCategories: [],
      recentTitles: [],
    };
  }

  // Last 3 reflections

  // Yesterday's tasks
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString().split("T")[0];
  const { data: yesterdayTasks } = await supabase
    .from("loop_tasks")
    .select("title, category, done, skipped")
    .eq("user_id", userId)
    .eq("for_date", yesterday);

  // 7-day completion rate
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString().split("T")[0];
  const { data: weekTasks } = await supabase
    .from("loop_tasks")
    .select("done")
    .eq("user_id", userId)
    .gte("for_date", weekAgo)
    .eq("is_optional", false);

  const total = weekTasks?.length || 0;
  const completed = weekTasks?.filter(t => t.done).length || 0;
  const completionRate = total > 0
    ? Math.round((completed / total) * 100) : 50;

  // Streak (try RPC first, then fallback)
  let streak = 0;
  try {
    const { data: streakData, error: streakError } = await supabase
      .rpc("get_user_streak", { uid: userId });
    if (!streakError) streak = streakData || 0;
  } catch (e) {
    console.warn("Streak RPC failed during context build", e);
  }

  // Onboarding data
  const { data: profile } = await supabase
    .from("user_context")
    .select("onboarding, skipped_categories")
    .eq("user_id", userId)
    .maybeSingle();

  // Mood trend from pattern_tags or answers
  const moods = (reflections || [])
    .map(r => r.pattern_tags?.[0]) // assuming first tag might be mood-related if not explicitly mood
    .filter(Boolean);

  // Recent titles (for no-repeat check)
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000)
    .toISOString().split("T")[0];
  const { data: recentTasks } = await supabase
    .from("loop_tasks")
    .select("title")
    .eq("user_id", userId)
    .gte("for_date", fiveDaysAgo);
  const recentTitles = (recentTasks || []).map(t => t.title);

  return {
    onboarding: profile?.onboarding || {},
    reflections: (reflections || []).map(r => ({
      date: r.date,
      answers: r.answers || [],
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
    skippedCategories: profile?.skipped_categories || [],
    recentTitles,
  };
}
