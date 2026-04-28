/* eslint-disable react-refresh/only-export-components */
import {
  createContext, useContext, useState,
  useEffect, useCallback,
} from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useUserStore } from "../store/userStore";
import { useMusicPlayer } from "../hooks/useMusicPlayer";
import { queryClient } from "../lib/queryClient";

const AppStateContext = createContext(null);

// Map domain labels for display
const DOMAIN_LABELS = {
  awareness: "5 minutes reflection",
  action: "30 minutes",
  meaning: "Gratitude & Growth",
};

const resolveLifeScore = ({
  cumulative_score,
}) => {
  if (cumulative_score === undefined || cumulative_score === null) {
    return "-";
  }

  const scoreValue = Number(cumulative_score);
  return Number.isFinite(scoreValue) ? scoreValue : "-";
};

const EMPTY_STATS = {
  streak: "-",
  lifeScore: "-",
  tasksCompleted: 0,
  vitality: 50,
  completionRate: 0,
  reflectionsDone: 0,
};

const EMPTY_BEHAVIOR = {
  avg_completion_rate: 0,
  streak: 0,
  total_reflections: 0,
};

const OPTIONAL_TABLES = {
  focusSessions: false,
  readingList: false,
};

export function AppStateProvider({ children }) {
  const storeUser = useUserStore(state => state.user);

  // Tasks
  const [tasks, setTasks] = useState([]);

  // Focus timer
  const [focusSession, setFocusSession] = useState(null);

  // Music player (global)
  const music = useMusicPlayer();

  // Reading list
  const [readingList, setReadingList] = useState([]);

  // Progress stats (derived)
  const [stats, setStats] = useState(EMPTY_STATS);
  const [userTree, setUserTree] = useState(undefined);
  const [userBehavior, setUserBehavior] = useState(undefined);

  const user = storeUser
    ? {
        ...storeUser,
        user_tree: userTree ?? storeUser.user_tree,
        user_behavior: userBehavior ?? storeUser.user_behavior,
      }
    : null;

  // ─── Load data when user logs in ───
  useEffect(() => {
    if (!storeUser || !isSupabaseConfigured) {
      setTasks([]);
      setStats(EMPTY_STATS);
      setReadingList([]);
      setUserTree(undefined);
      setUserBehavior(undefined);
      return;
    }
    
    // REAL MODE: Always load from Cloud Supabase
    loadTasks();
    loadStats({ markLoading: true });
    loadReadingList();
  }, [storeUser]);

  // ─── Tasks ───
  const loadTasks = async () => {
    if (!user || !isSupabaseConfigured) return;
    try {
      const localDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]; // YYYY-MM-DD local
      const { data, error } = await supabase
        .from("loop_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("for_date", localDate);
      
      if (!error) setTasks(data || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const toggleTask = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (task.completed_at != null) return;
    const completedAt = new Date().toISOString();

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, completed_at: completedAt, done: true } : t));
      
    try {
      const { data, error } = await supabase.rpc(
        "complete_loop_task_v4",
        { p_task_id: id }
      );
        
      if (error) {
        throw error;
      }

      if (data?.task) {
        setTasks(prev => prev.map(t =>
          t.id === id ? { ...t, ...data.task, done: true } : t));
      }

      loadStats();
    } catch (err) {
      console.error("Failed to update task:", err);
      // Revert on failure
      setTasks(prev => prev.map(t =>
        t.id === id ? task : t));
    }
  }, [tasks]);

  // ─── Focus Timer ───
  const startFocus = useCallback((minutes = 25) => {
    setFocusSession({
      startedAt: new Date().toISOString(),
      duration: minutes * 60,
      active: true,
    });
  }, []);

  const endFocus = useCallback(async () => {
    if (!focusSession) return;

    if (!OPTIONAL_TABLES.focusSessions) {
      setFocusSession(null);
      loadStats();
      return;
    }

    /* 
    TABLE MISSING: Disabling focus_sessions insert
    if (user && isSupabaseConfigured) {
      await supabase.from("focus_sessions").insert({
        user_id: user.id,
        duration_seconds: elapsed,
        completed,
        started_at: focusSession.startedAt,
      });
    }
    */

    setFocusSession(null);
    loadStats();
  }, [focusSession]);

  // ─── Reading List ───
  const loadReadingList = async () => {
    // TABLE MISSING: Disabling for now to prevent 404s
    setReadingList([]);
    /*
    if (!user || !isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("reading_list")
        .select("book_id")
        .eq("user_id", user.id);
      if (error) throw error;
      setReadingList((data || []).map(r => r.book_id));
    } catch (err) {
      console.warn("Reading_list table missing or inaccessible:", err);
      setReadingList([]);
    }
    */
  };

  const addToReadingList = useCallback(async (bookId) => {
    if (!OPTIONAL_TABLES.readingList) return;
    if (!isSupabaseConfigured) return;
    if (readingList.includes(bookId)) return;
    setReadingList(prev => [...prev, bookId]);
    if (!user) return;
    try {
      const { error } = await supabase
        .from("reading_list")
        .insert({ user_id: user.id, book_id: bookId });
      if (error) throw error;
    } catch (err) {
      console.error("Failed to add to reading list:", err);
      setReadingList(prev => prev.filter(id => id !== bookId));
    }
  }, [readingList, user]);

  // ─── Stats ───
  const fetchUserTreeStats = useCallback(async ({ markLoading = false } = {}) => {
    if (!storeUser?.id || !isSupabaseConfigured) {
      setUserTree(undefined);
      setStats((prev) => ({
        ...prev,
        streak: "-",
        lifeScore: "-",
        vitality: EMPTY_STATS.vitality,
      }));
      return undefined;
    }

    if (markLoading) {
      setUserTree(undefined);
      setStats((prev) => ({
        ...prev,
        streak: "-",
        lifeScore: "-",
        vitality: EMPTY_STATS.vitality,
      }));
    }

    const { data: treeData, error: treeError } = await supabase
      .from("user_tree")
      .select("*")
      .eq("user_id", storeUser.id)
      .maybeSingle();

    if (treeError) {
      throw treeError;
    }

    const nextTree = treeData
      ? {
          ...treeData,
          streak: treeData.streak ?? 0,
          cumulative_score: treeData.cumulative_score ?? 0,
          vitality: treeData.vitality ?? EMPTY_STATS.vitality,
        }
      : undefined;

    setUserTree(nextTree);
    setStats((prev) => ({
      ...prev,
      streak: nextTree?.streak ?? "-",
      lifeScore: nextTree
        ? resolveLifeScore({ cumulative_score: nextTree.cumulative_score })
        : "-",
      vitality: nextTree?.vitality ?? EMPTY_STATS.vitality,
    }));

    return nextTree;
  }, [storeUser?.id]);

  const fetchUserBehaviorStats = useCallback(async () => {
    if (!storeUser?.id || !isSupabaseConfigured) {
      setUserBehavior(undefined);
      return undefined;
    }

    const { data: behaviorData, error: behaviorError } = await supabase
      .from("user_behavior")
      .select("avg_completion_rate, streak, total_reflections, total_tasks_completed")
      .eq("user_id", storeUser.id)
      .maybeSingle();

    if (behaviorError) {
      console.warn("Failed to load behavior stats:", behaviorError.message);
      setUserBehavior(undefined);
      return undefined;
    }

    const nextBehavior = behaviorData
      ? {
          ...behaviorData,
          avg_completion_rate: behaviorData.avg_completion_rate ?? EMPTY_BEHAVIOR.avg_completion_rate,
          streak: behaviorData.streak ?? EMPTY_BEHAVIOR.streak,
          total_reflections: behaviorData.total_reflections ?? EMPTY_BEHAVIOR.total_reflections,
        }
      : EMPTY_BEHAVIOR;

    setUserBehavior(nextBehavior);
    setStats((prev) => ({
      ...prev,
      completionRate: Math.round((nextBehavior.avg_completion_rate ?? 0) * 100),
      reflectionsDone: nextBehavior.total_reflections ?? 0,
      streak: userTree?.streak ?? nextBehavior.streak ?? prev.streak,
    }));

    return nextBehavior;
  }, [storeUser?.id, userTree?.streak]);

  const loadStats = async ({ markLoading = false } = {}) => {
    if (!storeUser || !isSupabaseConfigured) return;
    try {
      const localDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const treeData = await fetchUserTreeStats({ markLoading });
      const behaviorData = await fetchUserBehaviorStats();

      // 2. Fetch today's core loop tasks without HEAD; some Supabase setups reject count paths
      const { data: todayTasks, error: taskError } = await supabase
        .from("loop_tasks")
        .select("id, category, completed_at, is_optional")
        .eq("user_id", storeUser.id)
        .eq("for_date", localDate)
        .in("category", ["awareness", "action", "meaning"]);

      if (taskError) throw taskError;

      const coreTasks = (todayTasks || []).filter(task => !task.is_optional);
      const completedToday = new Set(
        coreTasks
          .filter(task => task.completed_at)
          .map(task => task.category)
      ).size;
      const totalCoreTasks = Math.max(
        3,
        new Set(coreTasks.map(task => task.category)).size
      );

      setStats((prev) => ({
        ...prev,
        streak: treeData?.streak ?? prev.streak,
        lifeScore: treeData
          ? resolveLifeScore({ cumulative_score: treeData.cumulative_score })
          : prev.lifeScore,
        tasksCompleted: completedToday,
        vitality: treeData?.vitality ?? prev.vitality,
        completionRate: behaviorData?.avg_completion_rate !== undefined
          ? Math.round((behaviorData.avg_completion_rate ?? 0) * 100)
          : totalCoreTasks
            ? Math.round((completedToday / totalCoreTasks) * 100)
            : prev.completionRate,
        reflectionsDone: behaviorData?.total_reflections ?? prev.reflectionsDone,
      }));
    } catch (err) {
      console.error("Failed to load stats (global):", err);
    }
  };

  const updateTreeStats = useCallback(({
    vitality,
    cumulative_score,
    streak,
    tasksCompleted,
    tasksCompletedDelta = 0,
  }) => {
    setUserTree((prev) => {
      if (!prev && vitality === undefined && cumulative_score === undefined && streak === undefined) {
        return prev;
      }

      return {
        ...(prev ?? {}),
        ...(vitality !== undefined ? { vitality } : {}),
        ...(cumulative_score !== undefined ? { cumulative_score } : {}),
        ...(streak !== undefined ? { streak } : {}),
      };
    });

    if (streak !== undefined) {
      setUserBehavior((prev) => ({
        ...(prev ?? EMPTY_BEHAVIOR),
        streak,
      }));
    }

    setStats((prev) => ({
      ...prev,
      vitality: vitality ?? prev.vitality,
      streak: streak ?? prev.streak,
      tasksCompleted: typeof tasksCompleted === "number"
        ? tasksCompleted
        : Math.max(0, prev.tasksCompleted + tasksCompletedDelta),
      lifeScore: cumulative_score === undefined
        ? prev.lifeScore
        : resolveLifeScore({ cumulative_score }),
    }));

    if (!user?.id) return;

    queryClient.setQueryData(["tree_metrics", user.id], (current) => {
      if (!current) return current;

      const nextDoneCount = typeof tasksCompleted === "number"
        ? tasksCompleted
        : Math.max(0, (current.todayTasks?.done ?? 0) + tasksCompletedDelta);

      return {
        ...current,
        score: cumulative_score ?? current.score,
        vitality: vitality ?? current.vitality,
        streak: streak ?? current.streak,
        todayTasks: current.todayTasks
          ? {
              ...current.todayTasks,
              done: Math.min(
                current.todayTasks.total ?? Number.MAX_SAFE_INTEGER,
                nextDoneCount
              ),
            }
          : current.todayTasks,
      };
    });
  }, [user?.id]);

  const value = {
    user,
    user_tree: userTree,
    user_behavior: userBehavior,
    tasks, toggleTask, loadTasks,
    focusSession, startFocus, endFocus,
    ...music,
    readingList, addToReadingList,
    stats, loadStats, setStats, fetchUserTreeStats, fetchUserBehaviorStats, updateTreeStats,
    DOMAIN_LABELS,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export const useAppState = () => {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be inside AppStateProvider");
  return ctx;
};
