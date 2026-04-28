import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAppState } from "../contexts/AppStateContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const AUTO_GENERATION_ERROR =
  "We couldn't prepare today's plan yet. Open The Loop to try again.";

const getLocalDate = () => new Date().toLocaleDateString("en-CA");

const toSortNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.MAX_SAFE_INTEGER;
};

const toTimestamp = (value) => {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

const sortTasks = (rows) => [...rows].sort((a, b) => {
  const sortOrderDiff = toSortNumber(a.sort_order) - toSortNumber(b.sort_order);
  if (sortOrderDiff !== 0) return sortOrderDiff;

  const createdAtDiff = toTimestamp(a.created_at) - toTimestamp(b.created_at);
  if (createdAtDiff !== 0) return createdAtDiff;

  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
});

const normalizeTask = (row = {}) => {
  const durationMinutes = row.duration_minutes ?? row.estimated_duration_mins ?? 15;
  const completedAt = row.completed_at ?? null;

  return {
    ...row,
    completed_at: completedAt,
    done: Boolean(completedAt),
    why: row.why ?? row.why_this_helps ?? "",
    duration_minutes: durationMinutes,
    estimated_duration_mins: row.estimated_duration_mins ?? durationMinutes,
    detail_title: row.detail_title ?? row.title ?? "",
    detail_description: row.detail_description ?? "",
    subtitle: row.subtitle ?? row.category ?? "",
  };
};

export function useLoopTasks() {
  const { user, updateTreeStats, loadStats, loadTasks } = useAppState();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState(null);
  const insight = "";

  const fetchTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([]);
      setError(null);
      setHasFetched(false);
      return [];
    }

    setLoading(true);
    setHasFetched(false);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("loop_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("for_date", getLocalDate());

      if (queryError) {
        throw queryError;
      }

      const normalizedTasks = sortTasks((data ?? []).map(normalizeTask));
      setTasks(normalizedTasks);
      return normalizedTasks;
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err.message || "Failed to load tasks. Please try again.");
      return [];
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [user?.id]);

  const generateTasks = useCallback(async ({
    regenerate = false,
    auto = false,
  } = {}) => {
    if (!user?.id) return [];

    setGenerating(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        setError(auto
          ? AUTO_GENERATION_ERROR
          : "Your session has expired. Please sign in again to generate your Loop.");
        return [];
      }

      const struggles = Array.isArray(user?.onboarding_answers)
        ? user.onboarding_answers.filter((value) => typeof value === "string" && value.trim())
        : [];
      const currentStreak = Number.isFinite(Number(user?.user_tree?.streak))
        ? Number(user.user_tree.streak)
        : 0;

      const payload = {
        user_id: user.id,
        local_date: getLocalDate(),
        struggles,
        current_streak: currentStreak,
        regenerate,
      };

      const response = await fetch(`${API_BASE_URL}/api/generate-loop-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          errorPayload?.detail || `Server returned ${response.status}`
        );
      }

      await response.json().catch(() => null);
      const nextTasks = await fetchTasks();
      await Promise.allSettled([
        loadTasks?.(),
        loadStats?.(),
      ]);
      return nextTasks;
    } catch (err) {
      console.error("Error generating tasks:", err);
      setError(auto
        ? AUTO_GENERATION_ERROR
        : err.message || "AI failed to generate tasks. Please try again.");
      return [];
    } finally {
      setGenerating(false);
    }
  }, [
    fetchTasks,
    loadStats,
    loadTasks,
    user?.id,
    user?.onboarding_answers,
    user?.user_tree?.streak,
  ]);

  const completeTaskInDb = useCallback(async (taskId) => {
    const { data, error: rpcError } = await supabase.rpc(
      "complete_loop_task_v4",
      { p_task_id: taskId }
    );

    if (rpcError) {
      throw rpcError;
    }

    return {
      task: normalizeTask({
        ...data?.task,
        completed_at: data?.task?.completed_at ?? new Date().toISOString(),
      }),
      metrics: {
        vitality: data?.new_vitality,
        cumulative_score: data?.new_score,
        streak: data?.new_streak,
        tasksCompleted: data?.new_total_completed_today,
        tasksTotal: data?.today_tasks_total,
        awardedPoints: data?.awarded_points,
        allTasksComplete: data?.all_tasks_complete,
      },
    };
  }, []);

  const toggleTask = useCallback(async (taskId, updatedTask) => {
    if (!taskId) return null;

    if (updatedTask) {
      const normalizedTask = normalizeTask({
        ...updatedTask,
        completed_at: updatedTask.completed_at ?? new Date().toISOString(),
      });
      setTasks((prev) => sortTasks(prev.map((task) => (
        task.id === taskId
          ? { ...task, ...normalizedTask, done: true }
          : task
      ))));
      return normalizedTask;
    }

    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.done) {
      return currentTask ?? null;
    }

    setError(null);
    setTasks((prev) => prev.map((task) => (
      task.id === taskId ? { ...task, completed_at: new Date().toISOString(), done: true } : task
    )));

    try {
      const { task: completedTask, metrics } = await completeTaskInDb(taskId);
      const normalizedTask = normalizeTask({
        ...currentTask,
        ...completedTask,
      });

      setTasks((prev) => sortTasks(prev.map((task) => (
        task.id === taskId ? { ...task, ...normalizedTask } : task
      ))));

      updateTreeStats?.(metrics);
      await Promise.all([
        loadTasks?.(),
        loadStats?.(),
      ]);

      return {
        ...normalizedTask,
        completionPayload: {
          task: normalizedTask,
          metrics,
        },
      };
    } catch (err) {
      console.error("Error completing task:", err);
      setTasks((prev) => prev.map((task) => (
        task.id === taskId ? currentTask : task
      )));
      setError(err.message || "Failed to update task.");
      throw err;
    }
  }, [completeTaskInDb, loadStats, loadTasks, tasks, updateTreeStats]);

  useEffect(() => {
    if (!user?.id) {
      setTasks([]);
      setError(null);
      setHasFetched(false);
      return;
    }

    fetchTasks();
  }, [fetchTasks, user?.id]);

  const clearError = () => setError(null);
  const refresh = () => generateTasks({ regenerate: true });

  return {
    tasks,
    loading,
    hasFetched,
    error,
    fetchTasks,
    generateTasks,
    toggleTask,
    // Provide compatible interface for TheLoopPage
    data: { tasks, insight },
    generating,
    refresh,
    clearError
  };
}
