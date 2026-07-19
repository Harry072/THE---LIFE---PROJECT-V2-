import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";

// Client-side mirror of the backend's safe default — the dashboard renders
// something coherent even if the endpoint is unreachable. Never a blank
// page, never an error surface.
const SAFE_DEFAULT = {
  user_display_name: "there",
  greeting: "Take it one step at a time.",
  greeting_prefix: "time_of_day",
  daily_quote: "One step is not nothing. It is the thing.",
  season: {
    season: "thriving",
    message: "The roots deepen with every action.",
    visual_hint: "morning",
  },
  primary_action: {
    feature: "loop",
    headline: "Your task for today is ready.",
    sub: "Two small actions, built from your signals.",
    cta_text: "Open The Loop",
    cta_route: "/loop",
  },
  feature_cards: [
    { feature: "loop", icon_key: "loop", headline: "Your task for today is ready.", priority: 1, route: "/loop" },
    { feature: "companion", icon_key: "chat", headline: "Your companion is listening.", priority: 2, route: "/companion" },
    { feature: "reflection", icon_key: "pen", headline: "Write one honest line today.", priority: 3, route: "/reflection" },
    { feature: "tree", icon_key: "sprout", headline: "Your tree is growing.", priority: 4, route: "/progress" },
    { feature: "curator", icon_key: "books", headline: "Something worth reading today.", priority: 5, route: "/curator" },
    { feature: "reset", icon_key: "meditate", headline: "A place to reset when needed.", priority: 6, route: "/meditation" },
  ],
  show_founder_note: false,
  tasks_today: { total: 0, completed: 0, all_done: false },
};

export function useDashboard() {
  const [payload, setPayload] = useState(SAFE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return undefined;
    fetchedRef.current = true;
    let cancelled = false;

    const load = async () => {
      try {
        const accessToken = await getSupabaseOrAppAccessToken(supabase);
        if (!accessToken) return;

        const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        if (!response.ok) return;

        const data = await response.json().catch(() => null);
        if (!cancelled && data?.greeting && Array.isArray(data.feature_cards)) {
          setPayload(data);
        }
      } catch (err) {
        console.error("Dashboard fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      // StrictMode dev double-mount: this cleanup cancels the first run —
      // release the guard so the re-run fetches fresh instead of leaving
      // the skeleton on screen forever.
      cancelled = true;
      fetchedRef.current = false;
    };
  }, []);

  return { payload, loading };
}
