/**
 * Tree Growth Scoring Service
 * Awards points for user actions and updates the growth tree state.
 * 
 * Point values:
 *   CORE_TASK: 10, OPTIONAL_TASK: 5, REFLECTION: 8,
 *   ALL_TASKS: 15 (bonus), STREAK: 5, MEDITATION: 3
 */
import { supabase } from "../lib/supabase";

const POINTS = {
  CORE_TASK:     10,
  OPTIONAL_TASK:  5,
  REFLECTION:     8,
  ALL_TASKS:     15,  // bonus for completing all core tasks + reflection
  STREAK:         5,
  MEDITATION:     3,
};

/**
 * Award points for a single action.
 * Upserts daily log → increments cumulative score → recalculates vitality.
 */
export async function awardTreePoints(userId, action) {
  if (!userId || !POINTS[action]) return;

  // Skip Supabase calls for demo users
  // Handle Demo users locally
  if (!isUUID) {
    const pts = POINTS[action];
    window.dispatchEvent(new CustomEvent('tree-point-awarded', { 
      detail: { points: pts } 
    }));
    return;
  }

  const pts = POINTS[action];
  const today = new Date().toISOString().split("T")[0];

  try {
    // TABLES MISSING: Neutralizing tree scoring service
    console.info("Tree scoring disabled temporarily (missing tables).");
    return;
    /*
    // 1. Upsert daily log row for today
    const { data: log } = await supabase
      .from("tree_daily_log")
      .upsert(
        { user_id: userId, for_date: today },
        { onConflict: "user_id,for_date" }
      )
      .select()
      .single();

    // 2. Increment today's points in daily log
    await supabase
      .from("tree_daily_log")
      .update({ points: (log?.points || 0) + pts })
      .eq("user_id", userId)
      .eq("for_date", today);

    // 3. Increment cumulative score atomically
    await supabase.rpc("increment_tree_score", {
      uid: userId,
      pts,
    });

    // 4. Recalculate vitality from last 7 days
    const { data: vitality } = await supabase
      .rpc("calc_vitality", { uid: userId });

    // 5. Update vitality on user_tree
    await supabase
      .from("user_tree")
      .update({
        vitality: vitality || 50,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    */
  } catch (err) {
    console.error("Tree scoring error:", err);
  }
}

/**
 * Check and award all-tasks bonus (15 pts).
 * Requirements: all core tasks done + reflection submitted today.
 * Uses `all_tasks_bonus_awarded` flag to prevent double-award.
 */
export async function checkAllTasksBonus(userId) {
  if (!userId) return;

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
  if (!isUUID) return;

  const today = new Date().toISOString().split("T")[0];

  try {
    // TABLES MISSING: Disabling all-tasks bonus check
    return;
    /*
    // Check if bonus already awarded today
    const { data: logRow } = await supabase
      .from("tree_daily_log")
      .select("all_tasks_bonus_awarded")
      .eq("user_id", userId)
      .eq("for_date", today)
      .maybeSingle();

    if (logRow?.all_tasks_bonus_awarded) return;

    // Check all core tasks are done
    const { data: tasks } = await supabase
      .from("loop_tasks")
      .select("done, is_optional")
      .eq("user_id", userId)
      .eq("for_date", today);

    const cores = (tasks || []).filter(t => !t.is_optional);
    const allCoreDone = cores.length > 0 && cores.every(t => t.done);

    // Check reflection exists
    const { data: reflection } = await supabase
      .from("reflections")
      .select("id")
      .eq("user_id", userId)
      .eq("for_date", today)
      .maybeSingle();

    if (allCoreDone && reflection) {
      // Award bonus
      await awardTreePoints(userId, "ALL_TASKS");

      // Set flag to prevent re-award
      await supabase
        .from("tree_daily_log")
        .update({ all_tasks_bonus_awarded: true })
        .eq("user_id", userId)
        .eq("for_date", today);
    }
    */
  } catch (err) {
    console.error("All-tasks bonus check error:", err);
  }
}

export { POINTS };
