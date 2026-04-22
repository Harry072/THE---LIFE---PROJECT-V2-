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

export function AppStateProvider({ children }) {
  const user = useUserStore(state => state.user);

  // Tasks
  const [tasks, setTasks] = useState([]);

  // Focus timer
  const [focusSession, setFocusSession] = useState(null);

  // Music player (global)
  const music = useMusicPlayer();
  const {
    currentTrack, isPlaying, play: playTrack, pause: pauseTrack,
  } = music;

  // Reading list
  const [readingList, setReadingList] = useState([]);

  // Progress stats (derived)
  const [stats, setStats] = useState({
    streak: 0,
    lifeScore: 0,
    tasksCompleted: 0,
    vitality: 50,
  });

  // ─── Load data when user logs in ───
  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setTasks([]);
      setStats({ streak: 0, lifeScore: 0, tasksCompleted: 0, vitality: 50 });
      setReadingList([]);
      return;
    }
    
    // REAL MODE: Always load from Cloud Supabase
    loadTasks();
    loadStats();
    loadReadingList();
  }, [user]);

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
    const wasDone = task.completed_at != null;
    const newCompletedAt = wasDone ? null : new Date().toISOString();

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, completed_at: newCompletedAt } : t));

    const update = wasDone
      ? { completed_at: null }
      : { completed_at: newCompletedAt };
      
    try {
      const { error } = await supabase
        .from("loop_tasks")
        .update(update)
        .eq("id", id);
        
      if (error) {
        throw error;
      }
      loadStats();
    } catch (err) {
      console.error("Failed to update task:", err);
      // Revert on failure
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, completed_at: wasDone ? task.completed_at : null } : t));
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

  const endFocus = useCallback(async (completed = false) => {
    if (!focusSession) return;
    const elapsed = Math.floor(
      (Date.now() - new Date(focusSession.startedAt)) / 1000
    );

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
  }, [focusSession, user]);

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
  const loadStats = async () => {
    if (!user || !isSupabaseConfigured) return;
    try {
      const localDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      
      // 1. Fetch from user_tree using * so missing columns do not 400 the whole request
      const { data: treeData, error: treeError } = await supabase
        .from("user_tree")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (treeError) throw treeError;

      // 2. Fetch completed tasks without HEAD; some Supabase setups reject that count path
      const { data: todayTasks, error: taskError } = await supabase
        .from("loop_tasks")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .eq("for_date", localDate)
        .not("completed_at", "is", null);

      if (taskError) throw taskError;

      setStats({
        streak: treeData?.streak || 0,
        lifeScore: treeData?.cumulative_score || 0,
        tasksCompleted: (todayTasks || []).length,
        vitality: treeData?.vitality || 50
      });
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
    setStats((prev) => ({
      ...prev,
      vitality: vitality ?? prev.vitality,
      lifeScore: cumulative_score ?? prev.lifeScore,
      streak: streak ?? prev.streak,
      tasksCompleted: typeof tasksCompleted === "number"
        ? tasksCompleted
        : Math.max(0, prev.tasksCompleted + tasksCompletedDelta),
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
    tasks, toggleTask, loadTasks,
    focusSession, startFocus, endFocus,
    ...music,
    readingList, addToReadingList,
    stats, loadStats, setStats, updateTreeStats,
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
