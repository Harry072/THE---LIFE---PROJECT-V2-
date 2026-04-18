import { buildUserContext } from "./buildUserContext";
import { getFallbackTasks } from "../data/taskFallbackPool";

export async function generateDailyTasks(userId) {
  let context;
  try {
    context = await buildUserContext(userId);
  } catch (e) {
    console.error("Failed to build user context:", e);
    context = { recentTitles: [], moods: [], streak: 0, completionRate: 50 };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Attempt to call backend AI generator
    const res = await fetch("/api/generate-loop-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, context }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("API failed");

    const data = await res.json();
    if (!Array.isArray(data) || data.length < 3) throw new Error("Invalid response");

    return data.map((t, i) => ({
      title: t.title || "Untitled task",
      subtitle: t.subtitle || "",
      category: t.category || "awareness",
      detail_title: t.detail_title || t.title,
      detail_description: t.detail_description || "",
      inline_quote: t.inline_quote || null,
      why: t.why || "",
      duration_minutes: Math.min(30, Math.max(5, t.duration_minutes || 15)),
      preferred_time: t.preferred_time || "morning",
      intensity: t.intensity || "medium",
      is_optional: i === 3,
      sort_order: i + 1,
      ai_generated: true,
    }));

  } catch (err) {
    console.warn("AI generation unavailable, using fallback:", err.message);
    return getFallbackTasks(context);
  }
}
