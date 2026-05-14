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
  return { ...counts, [value]: (counts[value] || 0) + 1 };
}, {});

// Detect alternating skip pattern: skip→done→skip or done→skip→done→skip over 4+ days
function hasAlternatingSkips(loopRows) {
  const byDate = {};
  loopRows.forEach((row) => {
    if (!row.for_date) return;
    if (!byDate[row.for_date]) byDate[row.for_date] = { done: 0, skipped: 0 };
    if (row.completed_at || row.done) byDate[row.for_date].done += 1;
    if (row.skipped) byDate[row.for_date].skipped += 1;
  });

  const dates = Object.keys(byDate).sort();
  if (dates.length < 4) return false;

  const recent = dates.slice(-4);
  let alternates = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = byDate[recent[i - 1]];
    const curr = byDate[recent[i]];
    const prevSkipped = prev.skipped > 0 && prev.done === 0;
    const currSkipped = curr.skipped > 0 && curr.done === 0;
    if (prevSkipped !== currSkipped) alternates++;
  }
  return alternates >= 2;
}

function chooseWhisper({ loopRows, resetRows, weeklyRows, streak }) {
  const frictionCounts = countBy(loopRows, (row) => row.task_friction_level);
  const moodCounts = countBy(loopRows, (row) => row.mood_after || row.post_action_mood);
  const resetMoodCounts = countBy(resetRows, (row) => row.mood_after);
  const resetTagCounts = countBy(resetRows, (row) => row.reflection_tag);
  const skippedActionCount = loopRows.filter((row) => row.skipped && row.category === "action").length;
  const completedCount = loopRows.filter((row) => row.completed_at || row.done).length;
  const latestWeekly = weeklyRows[0]?.synthesis_json || {};
  const nextFocus = typeof latestWeekly.next_focus === "string" ? latestWeekly.next_focus : "";
  const numericStreak = Number(streak || 0);

  const heavyMoods = (moodCounts.heavy || 0) + (moodCounts.anxious || 0)
    + (moodCounts.overwhelmed || 0) + (moodCounts.drained || 0);
  const clearMoods = (moodCounts.clear || 0) + (moodCounts.focused || 0);
  const heavyResetMoods = (resetMoodCounts.still_heavy || 0) + (resetMoodCounts.restless || 0)
    + (resetMoodCounts.heavy || 0);

  // Rule 1: heavy task friction or heavy post-action mood → step is intentionally smaller
  if ((frictionCounts.too_heavy || 0) > 0 || heavyMoods > 0) {
    return "Today's first step is smaller because your last action felt heavy.";
  }

  // Rule 2: restless post-action mood or heavy reset mood → one honest action
  if ((moodCounts.restless || 0) > 0 || heavyResetMoods > 0) {
    return "Restlessness is okay. One honest action can calm the mind.";
  }

  // Rule 2b: sleepy after reset → smallest possible step
  if ((resetMoodCounts.sleepy || 0) > 0) {
    return "Rest is part of the rhythm too. Choose the smallest possible step today.";
  }

  // Rule 2c: grateful after reset -> private reflection stays available
  if ((resetMoodCounts.grateful || 0) > 0) {
    return "A grateful moment is worth keeping. Save it quietly, or let it guide one gentle step.";
  }

  // Rule 3: alternating skip pattern → suggest one repeatable action
  if (hasAlternatingSkips(loopRows)) {
    return "Some days the doorway stays closed. One repeatable step, same time each day, builds the key.";
  }

  // Rule 4: action tasks repeatedly skipped → reduce friction
  if (skippedActionCount >= 2) {
    return "Action has been the harder doorway; make the next step almost too small to refuse.";
  }

  // Rule 4b: overthinking tag from reset → grounding action before intense focus
  if ((resetTagCounts.overthinking || 0) > 0) {
    return "Your mind still has some noise. A short grounding step before deeper focus today.";
  }

  // Rule 5: too easy + clear/focused → room for a stronger step
  if ((frictionCounts.too_easy || 0) >= 2 && clearMoods > 0) {
    return "You have room for a slightly stronger step today; keep the smaller version nearby.";
  }

  // Rule 6: steady streak and good completion → keep the rhythm
  if (completedCount >= 3 && numericStreak > 2) {
    return "You kept your rhythm. Today stays steady.";
  }

  // Rule 7: reset helped calm/clear the mind → carry that steadiness
  if (
    (resetMoodCounts.calmer || 0) > 0
    || (resetMoodCounts.clearer || 0) > 0
    || (resetMoodCounts.softer || 0) > 0
  ) {
    return "The reset helped soften the noise; carry that steadiness into one small action.";
  }

  // Rule 8: use Weekly Mirror next focus if available
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
          .select("mood_after,reflection_tag,next_step_type,completed_at,created_at")
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .limit(8),
        supabase
          .from("weekly_syntheses")
          .select("synthesis_json,updated_at")
          .eq("user_id", userId)
          .not("status", "eq", "insufficient_data")
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

      setWhisper(chooseWhisper({ loopRows, resetRows, weeklyRows, streak }));
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

  return { whisper, loading };
}
