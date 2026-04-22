import { buildUserContext } from "./buildUserContext";
import { getFallbackTasks } from "../data/taskFallbackPool";
import { useUserStore } from "../store/userStore";

export async function generateDailyTasks(userId, overrides = {}) {
  let context;
  try {
    context = await buildUserContext(userId);
  } catch (e) {
    console.error("Failed to build user context:", e);
    context = { recentTitles: [], moods: [], streak: 0, completionRate: 50, struggle_profile: [] };
  }

  // Merge any overrides (recentTitles, categoryScores) into context
  if (overrides.recentTitles) {
    context.recentTitles = [...new Set([...(context.recentTitles || []), ...overrides.recentTitles])];
  }
  if (overrides.categoryScores) {
    context.categoryScores = overrides.categoryScores;
  }

  // CRITICAL: Ensure struggle_profile is always present from the store
  if (!context.struggle_profile || context.struggle_profile.length === 0) {
    const profile = useUserStore.getState().profile;
    context.struggle_profile = profile?.struggle_tags || [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Grab the user session to send the JWT token to the secure backend
    const { supabase } = await import("../lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // Attempt to call backend AI generator
    const res = await fetch("http://127.0.0.1:8000/api/generate-loop-tasks", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ userId, context }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "AI generation failed");
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length < 3) throw new Error("Invalid response");

    return data.map((t, i) => ({
      id: t.id,
      title: t.title || "Untitled task",
      subtitle: t.subtitle || "",
      category: t.category || "mental",
      why_this_helps: t.why_this_helps || "",
      estimated_duration_mins: t.estimated_duration_mins || 15,
      supportive_tone_line: t.supportive_tone_line || "",
      // Fallback keys for the existing UI components to prevent visual breaking
      detail_title: t.title || "Untitled task",
      detail_description: t.supportive_tone_line || "",
      why: t.why_this_helps || "",
      duration_minutes: t.estimated_duration_mins || 15,
      preferred_time: "morning",
      intensity: "medium",
      is_optional: i === 3,
      sort_order: i + 1,
      ai_generated: true,
    }));

  } catch (err) {
    console.warn("AI generation error:", err.message);
    // Only use fallback for non-API errors (e.g., timeout, network) 
    // OR if you want to allow global fallback. 
    // The user wants strict error boundaries, so let's throw on 500s.
    if (err.message.includes("failed") || err.message.includes("sync")) {
      throw err;
    }
    return getFallbackTasks(context);
  }
}
