import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const DEFAULT_WHISPER = "One honest signal is enough for the mirror to begin forming.";

const getLocalDate = (date = new Date()) => date.toLocaleDateString("en-CA");

const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getLocalDate(date);
};

const normalize = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[-\s]+/g, "_");

const countBy = (items, getValue) => items.reduce((counts, item) => {
  const value = normalize(getValue(item));
  if (!value) return counts;
  return {
    ...counts,
    [value]: (counts[value] || 0) + 1,
  };
}, {});

function chooseWhisper({ loopRows, resetRows, weeklyRows, streak }) {
  const frictionCounts = countBy(loopRows, (row) => row.task_friction_level);
  const moodCounts = countBy(loopRows, (row) => row.mood_after || row.post_action_mood);
  const resetMoodCounts = countBy(resetRows, (row) => row.mood_after);
  const skippedActionCount = loopRows.filter((row) => row.skipped && row.category === "action").length;
  const completedCount = loopRows.filter((row) => row.completed_at || row.done).length;
  const latestWeekly = weeklyRows[0]?.synthesis_json || {};
  const nextFocus = typeof latestWeekly.next_focus === "string" ? latestWeekly.next_focus : "";

  if ((frictionCounts.too_heavy || 0) > 0 || (moodCounts.heavy || 0) > 0) {
    return "Your energy looks heavier today; one smaller version is enough.";
  }

  if ((moodCounts.restless || 0) > 0 || (resetMoodCounts.still_heavy || 0) > 0) {
    return "Your mind seems restless; begin with one visible action, not a full plan.";
  }

  if (skippedActionCount > 0) {
    return "Action has been the harder doorway; make the next step almost too small.";
  }

  if ((frictionCounts.too_easy || 0) >= 2 && (moodCounts.clear || moodCounts.focused || 0) > 0) {
    return "You have room for a slightly stronger step today; keep the smaller version nearby.";
  }

  if ((resetMoodCounts.clearer || 0) > 0 || (resetMoodCounts.softer || 0) > 0) {
    return "The reset helped soften the noise; carry that steadiness into one small action.";
  }

  if (completedCount >= 4 && Number(streak || 0) > 0) {
    return "Your consistency is quietly accumulating; keep today's promise simple.";
  }

  if (nextFocus) {
    return nextFocus;
  }

  return DEFAULT_WHISPER;
}

export function useContextualGreeting(userId, streak = 0) {
  const [whisper, setWhisper] = useState(DEFAULT_WHISPER);
  const [loading, setLoading] = useState(false);
  const sinceDate = useMemo(() => getDateDaysAgo(6), []);

  useEffect(() => {
    if (!userId) {
      setWhisper(DEFAULT_WHISPER);
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    setLoading(true);

    const loadSignals = async () => {
      const [loopResult, resetResult, weeklyResult] = await Promise.allSettled([
        supabase
          .from("loop_tasks")
          .select("category,completed_at,done,skipped,task_friction_level,post_action_mood,mood_after,for_date")
          .eq("user_id", userId)
          .gte("for_date", sinceDate)
          .order("for_date", { ascending: false })
          .limit(30),
        supabase
          .from("reset_sessions")
          .select("mood_after,reflection_tag,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("weekly_syntheses")
          .select("synthesis_json,updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      if (!isMounted) return;

      const loopRows = loopResult.status === "fulfilled" && !loopResult.value.error
        ? loopResult.value.data || []
        : [];
      const resetRows = resetResult.status === "fulfilled" && !resetResult.value.error
        ? resetResult.value.data || []
        : [];
      const weeklyRows = weeklyResult.status === "fulfilled" && !weeklyResult.value.error
        ? weeklyResult.value.data || []
        : [];

      setWhisper(chooseWhisper({
        loopRows,
        resetRows,
        weeklyRows,
        streak,
      }));
      setLoading(false);
    };

    loadSignals().catch(() => {
      if (!isMounted) return;
      setWhisper(DEFAULT_WHISPER);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [sinceDate, streak, userId]);

  return {
    whisper,
    loading,
  };
}

