import { supabase } from "./supabase";

const DEFAULT_TASKS = [
  { content: "Morning Journaling",
    domain: "awareness", scheduled_time: "06:00:00" },
  { content: "Workout & Movement",
    domain: "action", scheduled_time: "07:30:00" },
  { content: "Read 20 Pages",
    domain: "awareness", scheduled_time: "20:30:00" },
  { content: "Night Reflection",
    domain: "meaning", scheduled_time: "22:00:00" },
];

export async function seedNewUser(userId) {
  const today = new Date().toISOString().split("T")[0];
  const rows = DEFAULT_TASKS.map(t => ({
    content: t.content,
    domain: t.domain,
    user_id: userId,
    for_date: today,
  }));
  const { error } = await supabase.from("loop_tasks").insert(rows);
  if (error) console.error("Seed failed:", error);
}
