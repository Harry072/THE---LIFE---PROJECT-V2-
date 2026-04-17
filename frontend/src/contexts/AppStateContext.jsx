import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";
import { useMusicPlayer } from "../hooks/useMusicPlayer";

const AppStateContext = createContext(null);

// Default tasks used for demo mode and new-user seeding
const DEMO_TASKS = [
  { id: "demo-1", content: "Morning Journaling", domain: "awareness",
    assigned_date: new Date().toISOString().split("T")[0],
    completed_at: new Date().toISOString(), created_at: new Date().toISOString() },
  { id: "demo-2", content: "Workout & Movement", domain: "action",
    assigned_date: new Date().toISOString().split("T")[0],
    completed_at: null, created_at: new Date().toISOString() },
  { id: "demo-3", content: "Read 20 Pages", domain: "awareness",
    assigned_date: new Date().toISOString().split("T")[0],
    completed_at: null, created_at: new Date().toISOString() },
  { id: "demo-4", content: "Night Reflection", domain: "meaning",
    assigned_date: new Date().toISOString().split("T")[0],
    completed_at: null, created_at: new Date().toISOString() },
];

// Map domain labels for display
const DOMAIN_LABELS = {
  awareness: "5 minutes reflection",
  action: "30 minutes",
  meaning: "Gratitude & Growth",
};

export function AppStateProvider({ children }) {
  const user = useUserStore(state => state.user);
  const demoMode = useUserStore(state => state.demoMode);

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
  });

  // ─── Load data when user logs in ───
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setStats({ streak: 0, lifeScore: 0, tasksCompleted: 0 });
      setReadingList([]);
      return;
    }
    if (demoMode) {
      setTasks(DEMO_TASKS);
      setStats({ streak: 5, lifeScore: 42, tasksCompleted: 1 });
      setReadingList([]);
      return;
    }
    loadTasks();
    loadStats();
    loadReadingList();
  }, [user, demoMode]);

  // ─── Tasks ───
  const loadTasks = async () => {
    if (!user || demoMode) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("assigned_date", today)
      .order("created_at", { ascending: true });
    if (!error) setTasks(data || []);
  };

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const wasDone = task.completed_at != null;
    const newCompletedAt = wasDone ? null : new Date().toISOString();

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, completed_at: newCompletedAt } : t));

    if (demoMode) {
      // In demo mode update stats locally
      const completed = tasks.filter(t =>
        t.id === id ? !wasDone : t.completed_at != null).length;
      setStats(prev => ({ ...prev, tasksCompleted: completed }));
      return;
    }

    const update = wasDone
      ? { completed_at: null }
      : { completed_at: newCompletedAt };
    const { error } = await supabase
      .from("tasks")
      .update(update)
      .eq("id", id);
    if (error) {
      // Revert on failure
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, completed_at: wasDone ? task.completed_at : null } : t));
    } else {
      loadStats();
    }
  }, [tasks, demoMode]);

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

    if (!demoMode && user) {
      await supabase.from("focus_sessions").insert({
        user_id: user.id,
        duration_seconds: elapsed,
        completed,
        started_at: focusSession.startedAt,
      });
    }

    setFocusSession(null);
    if (!demoMode) loadStats();
  }, [focusSession, user, demoMode]);

  // ─── Reading List ───
  const loadReadingList = async () => {
    if (!user || demoMode) return;
    const { data } = await supabase
      .from("reading_list")
      .select("book_id")
      .eq("user_id", user.id);
    setReadingList((data || []).map(r => r.book_id));
  };

  const addToReadingList = useCallback(async (bookId) => {
    if (readingList.includes(bookId)) return;
    setReadingList(prev => [...prev, bookId]);
    if (demoMode || !user) return;
    const { error } = await supabase
      .from("reading_list")
      .insert({ user_id: user.id, book_id: bookId });
    if (error) {
      setReadingList(prev => prev.filter(id => id !== bookId));
    }
  }, [readingList, user, demoMode]);

  // ─── Stats ───
  const loadStats = async () => {
    if (!user || demoMode) return;
    try {
      // Tasks completed today
      const today = new Date().toISOString().split("T")[0];
      const { count: tasksCompleted } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("assigned_date", today)
        .not("completed_at", "is", null);

      // Streak
      let streak = 0;
      try {
        const { data: streakData } = await supabase.rpc(
          "get_user_streak", { uid: user.id }
        );
        streak = streakData || 0;
      } catch {
        // RPC may not exist yet — fall back to profile streak_count
        const profile = useUserStore.getState().profile;
        streak = profile?.streak_count || 0;
      }

      // Life Score
      const { data: focusData } = await supabase
        .from("focus_sessions")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .eq("completed", true);
      const focusMins = (focusData || [])
        .reduce((a, s) => a + s.duration_seconds, 0) / 60;
      const lifeScore = Math.round(
        (tasksCompleted || 0) * 3 + streak * 5 + focusMins / 5
      );

      setStats({ streak, lifeScore, tasksCompleted: tasksCompleted || 0 });
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const value = {
    tasks, toggleTask, loadTasks,
    focusSession, startFocus, endFocus,
    ...music,
    readingList, addToReadingList,
    stats, loadStats,
    demoMode,
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
