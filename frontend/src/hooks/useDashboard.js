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

// Plain imperative fetch — no React state, no SAFE_DEFAULT fallback. Callers
// that must fail CLOSED (e.g. the continuation chain's crisis gate) need a
// real null on any failure, never a safe-looking default that could mask an
// active crisis flag. useDashboard() below layers its own fail-open
// behavior on top of this for the dashboard page itself.
const DASHBOARD_FETCH_TIMEOUT_MS = 8000;

// `fresh` skips the server's 15-minute cache READ for this user only (see
// the /api/dashboard handler). Task completion is a direct client->Supabase
// RPC with no backend round-trip, so nothing can invalidate that cache
// server-side; the continuation chain asks for fresh data after a completion
// instead. Default false so the dashboard page's own render keeps using the
// cache -- passing it everywhere would delete the cache in all but name.
export async function fetchDashboardPayload({ fresh = false } = {}) {
  const accessToken = await getSupabaseOrAppAccessToken(supabase);
  if (!accessToken) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DASHBOARD_FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/dashboard${fresh ? "?fresh=1" : ""}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
      signal: controller.signal,
    });
  } catch (error) {
    // Abort (8s timeout) fails closed here, same as every other branch in
    // this function. Any other fetch failure (network down, DNS, CORS)
    // keeps rethrowing exactly as before this fix — callers (evaluateCompletion,
    // useDashboard()) already catch and fail closed on that.
    if (error?.name === "AbortError") return null;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data?.greeting || !Array.isArray(data.feature_cards)) return null;
  return data;
}

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
        const data = await fetchDashboardPayload();
        if (!cancelled && data) {
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
