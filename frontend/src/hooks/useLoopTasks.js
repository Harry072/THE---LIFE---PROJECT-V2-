import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAppState } from "../contexts/AppStateContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

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

const isLegacyDoneColumnError = (error) => {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("column") && message.includes("done");
};

export function useLoopTasks() {
  const { user, updateTreeStats } = useAppState();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const insight = "";

  const fetchTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([]);
      setError(null);
      return [];
    }

    setLoading(true);
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
    }
  }, [user?.id]);

  const generateTasks = useCallback(async () => {
    if (!user?.id) return [];

    setGenerating(true);
    setError(null);

    try {
      const payload = {
        user_id: user.id,
        local_date: getLocalDate(),
      };

      const response = await fetch(`${API_BASE_URL}/api/generate-loop-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      return await fetchTasks();
    } catch (err) {
      console.error("Error generating tasks:", err);
      setError(err.message || "AI failed to generate tasks. Please try again.");
      return [];
    } finally {
      setGenerating(false);
    }
  }, [fetchTasks, user?.id]);

  const completeTaskInDb = useCallback(async (taskId) => {
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "complete_loop_task_v4",
        { p_task_id: taskId }
      );

      if (rpcError) {
        throw rpcError;
      }

      return {
        task: normalizeTask({ ...data?.task, completed_at: data?.task?.completed_at ?? new Date().toISOString() }),
        metrics: {
          vitality: data?.new_vitality,
          cumulative_score: data?.new_score,
          streak: data?.new_streak,
          tasksCompletedDelta: 1,
        },
      };
    } catch (error) {
      if (!isLegacyDoneColumnError(error)) {
        throw error;
      }

      const completedAt = new Date().toISOString();
      const { data: fallbackTask, error: updateError } = await supabase
        .from("loop_tasks")
        .update({ completed_at: completedAt })
        .eq("id", taskId)
        .is("completed_at", null)
        .select("*")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!fallbackTask) {
        throw new Error("Task was already completed or could not be updated.");
      }

      return {
        task: normalizeTask(fallbackTask),
        metrics: {
          tasksCompletedDelta: 1,
        },
      };
    }
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

      return normalizedTask;
    } catch (err) {
      console.error("Error completing task:", err);
      setTasks((prev) => prev.map((task) => (
        task.id === taskId ? currentTask : task
      )));
      setError(err.message || "Failed to update task.");
      throw err;
    }
  }, [completeTaskInDb, tasks, updateTreeStats]);

  useEffect(() => {
    if (!user?.id) {
      setTasks([]);
      setError(null);
      return;
    }

    fetchTasks();
  }, [fetchTasks, user?.id]);

  const clearError = () => setError(null);
  const refresh = () => generateTasks();

  return {
    tasks,
    loading,
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
