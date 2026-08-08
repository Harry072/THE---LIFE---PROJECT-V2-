import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { useAppState } from "../contexts/AppStateContext";
import { API_BASE_URL } from "../lib/apiConfig";

const CORE_LOOP_CATEGORIES = ["awareness", "action", "reflection", "reset", "growth"];
const AUTO_GENERATION_ERROR =
  "We couldn't prepare today's plan yet. Open The Loop to try again.";
const AI_RETRYABLE_ERROR =
  "We couldn't prepare today's AI tasks yet. Try once more and we'll either use Gemini or create a small safe plan for today.";
const TASK_GENERATION_ERROR =
  "We couldn't prepare today's plan yet. Try again in a moment.";

const getLocalDate = () => new Date().toLocaleDateString("en-CA");

const isPlainObject = (value) => (
  Boolean(value) &&
  Object.prototype.toString.call(value) === "[object Object]" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const cleanStringArray = (value) => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const cleanOptionalString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeGenerateOptions = (options) => {
  const source = isPlainObject(options) ? options : {};

  return {
    regenerate: Boolean(source.regenerate || source.force),
    auto: Boolean(source.auto),
    contextStruggles: cleanStringArray(source.contextStruggles ?? source.struggles),
    recalibrateTag: cleanOptionalString(source.recalibrate_tag ?? source.recalibrateTag),
    allowSafeFallback: Boolean(source.allowSafeFallback || source.allow_safe_fallback),
  };
};

const getGenerationErrorMessage = (err, auto = false) => {
  if (auto) return AUTO_GENERATION_ERROR;

  const message = String(err?.message || "");
  if (
    /circular structure|json\.stringify|converting circular/i.test(message) ||
    /failed to generate or save tasks|server returned 500|internal server error/i.test(message)
  ) {
    return TASK_GENERATION_ERROR;
  }

  return message || TASK_GENERATION_ERROR;
};

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

export const normalizeLoopCategory = (value, row = {}) => {
  const subtitle = String(row?.subtitle || "").toLowerCase().replace(/_/g, "-");
  if (subtitle.includes("reflection") || subtitle.includes("journal")) return "reflection";
  if (subtitle.includes("reset") || subtitle.includes("breath") || subtitle.includes("ground")) return "reset";
  if (subtitle.includes("growth") || subtitle.includes("meaning") || subtitle.includes("purpose")) return "growth";
  const category = String(value || "").toLowerCase().replace(/_/g, "-");
  if (category === "meaning") return "growth";
  if (category === "emotional-reset") return "reset";
  return category;
};

export const isCoreLoopTask = (task = {}) => {
  const category = normalizeLoopCategory(task?.category, task);
  const isOptional = [true, "true", "True", "1", 1].includes(task?.is_optional);
  const isCompatCore = isOptional && String(task?.subtitle || "").toLowerCase().includes("practice");
  return CORE_LOOP_CATEGORIES.includes(category) && (!isOptional || isCompatCore);
};

const sentenceBeforeAction = (value = "") => (
  String(value).split(/\bAction:\s*/i)[0]?.trim() || ""
);

const actionAfterMarker = (value = "") => (
  String(value).split(/\bAction:\s*/i)[1]?.trim() || ""
);

const normalizeTask = (row = {}) => {
  const durationMinutes = row.duration_minutes ?? row.estimated_duration_mins ?? 15;
  const completedAt = row.completed_at ?? null;
  const detailDescription = row.detail_description ?? "";

  return {
    ...row,
    category: normalizeLoopCategory(row.category, row),
    completed_at: completedAt,
    done: Boolean(completedAt),
    why: row.why ?? row.why_this_helps ?? "",
    duration_minutes: durationMinutes,
    estimated_duration_mins: row.estimated_duration_mins ?? durationMinutes,
    detail_title: row.detail_title ?? row.title ?? "",
    detail_description: detailDescription,
    subtitle: row.subtitle ?? row.category ?? "",
    task_friction_level: row.task_friction_level ?? null,
    post_action_mood: row.post_action_mood ?? null,
    mood_after: row.mood_after ?? null,
    completion_state: row.completion_state ?? (completedAt ? "done" : "pending"),
    smaller_version: row.smaller_version ?? row.easier_version ?? "",
    success_condition: row.success_condition ?? "",
    post_completion_question: row.post_completion_question ?? "",
    kotler_tag: row.kotler_tag ?? "",
    ikigai_purpose: row.ikigai_purpose || row.why || row.why_this_helps || sentenceBeforeAction(detailDescription),
    waar_action: row.waar_action || actionAfterMarker(detailDescription) || row.success_condition || "",
  };
};

export function useLoopTasks() {
  const { user, updateTreeStats, loadStats, loadTasks } = useAppState();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState(null);
  const [retryWithSafeFallback, setRetryWithSafeFallback] = useState(false);
  const generationInFlightRef = useRef(false);
  const latestTasksRef = useRef([]);
  const insight = "";

  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

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

      const normalizedTasks = sortTasks((data ?? []).map(normalizeTask).filter(isCoreLoopTask));
      setTasks(normalizedTasks);
      if (normalizedTasks.length > 0) {
        setRetryWithSafeFallback(false);
      }
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

  const generateTasks = useCallback(async (options = {}) => {
    if (!user?.id) return [];
    if (generationInFlightRef.current) {
      return latestTasksRef.current;
    }

    const {
      regenerate,
      auto,
      contextStruggles,
      recalibrateTag,
      allowSafeFallback,
    } = normalizeGenerateOptions(options);

    generationInFlightRef.current = true;
    setGenerating(true);
    setError(null);

    try {
      const accessToken = await getSupabaseOrAppAccessToken(supabase);

      if (!accessToken) {
        setError(auto
          ? AUTO_GENERATION_ERROR
          : "Your session has expired. Please sign in again to generate your Loop.");
        return [];
      }

      const struggles = contextStruggles ?? (() => {
        const meta = user?.user_metadata ?? {};
        const tags = meta.struggle_tags ?? meta.struggles ?? meta.onboarding_answers ?? [];
        return cleanStringArray(tags) ?? [];
      })();
      const currentStreak = Number.isFinite(Number(user?.user_tree?.streak))
        ? Number(user.user_tree.streak)
        : 0;

      const payload = {
        user_id: String(user.id),
        local_date: getLocalDate(),
        struggles,
        current_streak: currentStreak,
        regenerate: Boolean(regenerate),
        recalibrate_tag: recalibrateTag,
        allow_safe_fallback: Boolean(allowSafeFallback || retryWithSafeFallback),
      };

      const requestBody = JSON.stringify(payload);

      const response = await fetch(`${API_BASE_URL}/api/generate-loop-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          errorPayload?.detail || `Server returned ${response.status}`
        );
      }

      const responsePayload = await response.json().catch(() => null);
      if (responsePayload?.status === "retryable_ai_failure") {
        setRetryWithSafeFallback(true);
        setTasks([]);
        setError(auto ? AUTO_GENERATION_ERROR : responsePayload?.meta?.message || AI_RETRYABLE_ERROR);
        return [];
      }

      setRetryWithSafeFallback(false);
      const responseTasks = sortTasks(
        (responsePayload?.data ?? []).map(normalizeTask).filter(isCoreLoopTask)
      );
      if (responseTasks.length > 0) {
        setTasks(responseTasks);
      }
      const nextTasks = responseTasks.length > 0 ? responseTasks : await fetchTasks();
      Promise.allSettled([
        loadTasks?.(),
        loadStats?.(),
      ]).catch(() => {});
      return nextTasks;
    } catch (err) {
      console.error("Error generating tasks:", err);
      setError(getGenerationErrorMessage(err, auto));
      return [];
    } finally {
      generationInFlightRef.current = false;
      setGenerating(false);
    }
  }, [
    fetchTasks,
    loadStats,
    loadTasks,
    retryWithSafeFallback,
    user?.id,
    user?.user_metadata,
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

  const saveTaskFeedback = useCallback(async (taskId, feedback = {}) => {
    if (!user?.id || !taskId) return null;

    const accessToken = await getSupabaseOrAppAccessToken(supabase);

    if (!accessToken) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(`${API_BASE_URL}/api/loop-tasks/${taskId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        ...feedback,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || `Server returned ${response.status}`);
    }

    const updatedTask = payload?.task ? normalizeTask(payload.task) : null;
    if (updatedTask?.id) {
      setTasks((prev) => sortTasks(prev.map((task) => (
        task.id === updatedTask.id
          ? { ...task, ...updatedTask }
          : task
      ))));
    }

    return updatedTask;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setTasks([]);
      setError(null);
      setRetryWithSafeFallback(false);
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
    saveTaskFeedback,
    // Provide compatible interface for TheLoopPage
    data: { tasks, insight },
    generating,
    retryWithSafeFallback,
    refresh,
    clearError
  };
}
