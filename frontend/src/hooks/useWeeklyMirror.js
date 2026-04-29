import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAppState } from "../contexts/AppStateContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const getLocalDate = (date = new Date()) => date.toLocaleDateString("en-CA");

const getWeekRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    week_start: getLocalDate(start),
    week_end: getLocalDate(end),
  };
};

const getFocusStorageKey = (userId) => `lifeProject.weeklyMirror.nextFocus.${userId}`;
const getRecommendationStorageKey = (userId) => (
  `lifeProject.weeklyMirror.recommendedStep.${userId}`
);

export function useWeeklyMirror() {
  const { user } = useAppState();
  const weekRange = useMemo(getWeekRange, []);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [synthesis, setSynthesis] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  const revealWeeklyMirror = useCallback(async () => {
    if (!user?.id) {
      const message = "Sign in again to reveal your Weekly Mirror.";
      setError(message);
      setStatus("error");
      return { status: "error", error: message };
    }

    setLoading(true);
    setError("");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(`${API_BASE_URL}/api/weekly-synthesis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          ...weekRange,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || `Server returned ${response.status}`);
      }

      const mirrorInsight = payload?.mirror_insight || payload?.synthesis || null;
      const normalizedPayload = {
        ...(payload || {}),
        synthesis: mirrorInsight,
        mirror_insight: mirrorInsight,
      };

      setStatus(payload?.status || "success");
      setSynthesis(mirrorInsight);
      setMeta(payload?.meta || null);
      return normalizedPayload;
    } catch (requestError) {
      const message = requestError?.message || "The mirror could not form right now.";
      setError(message);
      setStatus("error");
      return { status: "error", error: message };
    } finally {
      setLoading(false);
    }
  }, [user?.id, weekRange]);

  const carryFocus = useCallback(() => {
    const nextFocus = synthesis?.next_focus;
    if (!user?.id || !nextFocus || typeof window === "undefined") return;

    window.localStorage.setItem(
      getFocusStorageKey(user.id),
      JSON.stringify({
        next_focus: nextFocus,
        week_start: weekRange.week_start,
        week_end: weekRange.week_end,
        saved_at: new Date().toISOString(),
      })
    );
  }, [synthesis?.next_focus, user?.id, weekRange]);

  const carryRecommendation = useCallback((recommendation) => {
    if (!user?.id || !recommendation || typeof window === "undefined") return;

    window.localStorage.setItem(
      getRecommendationStorageKey(user.id),
      JSON.stringify({
        recommended_next_step: recommendation,
        week_start: weekRange.week_start,
        week_end: weekRange.week_end,
        saved_at: new Date().toISOString(),
      })
    );
  }, [user?.id, weekRange]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
  }, []);

  return {
    loading,
    status,
    synthesis,
    meta,
    error,
    weekRange,
    revealWeeklyMirror,
    carryFocus,
    carryRecommendation,
    reset,
  };
}
