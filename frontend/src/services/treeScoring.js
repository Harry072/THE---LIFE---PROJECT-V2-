/**
 * Tree Growth Scoring Service
 * Awards points for user actions and updates the growth tree state.
 * 
 * Point values:
 *   CORE_TASK: 10, OPTIONAL_TASK: 5, REFLECTION: 8,
 *   ALL_TASKS: 15 (bonus), STREAK: 5, MEDITATION: 3
 */

const POINTS = {
  CORE_TASK:     10,
  OPTIONAL_TASK:  5,
  REFLECTION:     8,
  ALL_TASKS:     15,  // bonus for completing all core tasks + reflection
  STREAK:         5,
  MEDITATION:     3,
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/**
 * Award points for a single action.
 * Upserts daily log → increments cumulative score → recalculates vitality.
 */
export async function awardTreePoints(userId, action) {
  if (!userId || !POINTS[action]) return;

  // Skip Supabase calls for demo users
  // Handle Demo users locally
  if (!isUuid(userId)) {
    const pts = POINTS[action];
    window.dispatchEvent(new CustomEvent('tree-point-awarded', { 
      detail: { points: pts } 
    }));
    return;
  }

  // Canonical scoring now runs through complete_loop_task_v4.
  console.info("Tree scoring service is disabled; backend RPC owns scoring.");
}

/**
 * Check and award all-tasks bonus (15 pts).
 * Requirements: all core tasks done + reflection submitted today.
 * Uses `all_tasks_bonus_awarded` flag to prevent double-award.
 */
export async function checkAllTasksBonus(userId) {
  if (!userId) return;

  if (!isUuid(userId)) return;

  // Canonical all-task bonus logic now runs through complete_loop_task_v4.
}

export { POINTS };
