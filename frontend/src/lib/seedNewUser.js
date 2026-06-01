import { supabase } from "./supabase";

const DEFAULT_TASKS = [
  { title: "Morning Journaling",   category: "awareness" },
  { title: "Workout & Movement",   category: "action" },
  { title: "Night Reflection",     category: "reflection" },
  { title: "Five Slow Breaths",    category: "reset" },
  { title: "One Useful Act",       category: "growth" },
];

export async function seedNewUser(userId) {
  const today = new Date().toISOString().split("T")[0];
  const rows = DEFAULT_TASKS.map((t, i) => ({
    title: t.title,
    category: t.category,
    user_id: userId,
    for_date: today,
    sort_order: i + 1,
    ai_generated: false,
    is_optional: false,
    done: false,
    completion_state: "pending",
  }));
  const { error } = await supabase.from("loop_tasks").insert(rows);
  if (error) console.error("Seed failed:", error);
}
