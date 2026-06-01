import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { useAppState } from "../contexts/AppStateContext";
import { useUserStore } from "../store/userStore";
import { API_BASE_URL } from "../lib/apiConfig";
const DEFAULT_PAIN_POINT = "I feel lost";

const getLocalDate = () => new Date().toLocaleDateString("en-CA");

function getDismissedKey(userId) {
  return `lifeProject.executionEngine.dismissed.${userId}.${getLocalDate()}`;
}

function getInitialDismissed(userId) {
  if (!userId || typeof window === "undefined") return false;
  return window.localStorage.getItem(getDismissedKey(userId)) === "true";
}

// In-memory pain-point resolution — no DB query, no network request.
// Reads from the Zustand profile store and Supabase Auth user_metadata.
function resolveInMemoryPainPoint(profile, user) {
  // Tier A: Zustand profile store (populated by useUserStore)
  const profileTags = profile?.struggle_tags;
  if (Array.isArray(profileTags) && profileTags.length > 0) {
    const first = String(profileTags[0] ?? "").trim();
    if (first) return first;
  }

  // Tier B: Supabase Auth user_metadata (written at signup)
  const meta = user?.user_metadata ?? {};
  for (const src of [meta.struggles, meta.struggle_tags, meta.onboarding_answers]) {
    if (Array.isArray(src) && src.length > 0) {
      const first = String(src[0] ?? "").trim();
      if (first) return first;
    }
    if (typeof src === "string" && src.trim()) return src.trim();
  }

  // Tier C: legacy onboarding_answers field
  const answers = Array.isArray(user?.onboarding_answers) ? user.onboarding_answers : [];
  if (answers.length > 0) {
    const first = String(answers[0] ?? "").trim();
    if (first) return first;
  }

  // Tier D: guaranteed safe default
  return DEFAULT_PAIN_POINT;
}

export function useExecutionEngine({
  enabled = true,
  completedTasksCount = 0,
  recentTasks = [],
} = {}) {
  const { user } = useAppState();
  const profile = useUserStore((state) => state.profile);

  const [action, setAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(() => getInitialDismissed(user?.id));
  const [celebrated, setCelebrated] = useState(false);

  const hasFetchedRef = useRef(false);

  // Exposed so the card can display which pain point is active.
  // Reads from the in-memory store — DB result updates this via re-render after fetch.
  const primaryPainPoint = resolveInMemoryPainPoint(profile, user);

  const fetchAction = useCallback(async () => {
    if (!user?.id || !enabled) return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const accessToken = await getSupabaseOrAppAccessToken(supabase);

      if (!accessToken) {
        setError("Session expired.");
        return;
      }

      // Resolve pain point from in-memory Auth metadata — no DB query.
      // buildProfileFromMetadata in userStore already normalises struggle_tags
      // from all legacy key names, so getState().profile is always populated.
      const painPoint = resolveInMemoryPainPoint(useUserStore.getState().profile, user);

      const response = await fetch(`${API_BASE_URL}/api/execution-engine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          pain_point: painPoint,
          completed_tasks_count: Math.max(0, Math.floor(completedTasksCount)),
          recent_tasks: recentTasks.slice(0, 5),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || `Server returned ${response.status}`);
      }

      const payload = await response.json();
      setAction({
        taskTitle: payload.taskTitle,
        durationLabel: payload.durationLabel,
        contextNote: payload.contextNote,
      });
    } catch (err) {
      setError(err.message || "Could not load your action.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, enabled]);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    setDismissed(getInitialDismissed(user.id));
    fetchAction();
  }, [fetchAction, enabled, user?.id]);

  const handleDismiss = useCallback(() => {
    if (!user?.id) return;
    window.localStorage.setItem(getDismissedKey(user.id), "true");
    setCelebrated(true);
    setTimeout(() => {
      setCelebrated(false);
      setDismissed(true);
    }, 2000);
  }, [user?.id]);

  return {
    action,
    loading,
    error,
    dismissed,
    celebrated,
    primaryPainPoint,
    handleDismiss,
  };
}
