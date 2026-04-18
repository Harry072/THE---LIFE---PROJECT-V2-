import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";
import { generateDailyTasks } from "../services/generateTasks";

export function useLoopTasks() {
  const user = useUserStore(state => state.user);
  const today = new Date().toISOString().split("T")[0];
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user) loadOrGenerate();
  }, [user]);

  const loadOrGenerate = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Check if real user (UUID) or demo user
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id);

      if (!isUUID) {
        // DEMO MODE: Generate locally, don't hit Supabase
        setGenerating(true);
        const generated = await generateDailyTasks(user.id);
        setTasks(generated.map((t, i) => ({
          ...t,
          id: `demo-${Date.now()}-${i}`,
          user_id: user.id,
          for_date: today,
          done: false,
          skipped: false,
        })));
        setGenerating(false);
        setLoading(false);
        return;
      }

      // REAL MODE: Try loading existing tasks from Supabase
      const { data, error: loadError } = await supabase
        .from("loop_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("for_date", today)
        .order("sort_order");

      if (data && data.length > 0) {
        setTasks(data);
        setLoading(false);
        return;
      }

      // Fetch category mastery to drive personalized guidance
      const { data: masteryData } = await supabase
        .from("loop_tasks")
        .select("category, done")
        .eq("user_id", user.id)
        .eq("done", true);
      
      const categoryScores = (masteryData || []).reduce((acc, row) => {
        acc[row.category] = (acc[row.category] || 0) + 1;
        return acc;
      }, {});

      // Fetch titles from the last 5 days to ensure no repeats
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      
      const { data: recentData } = await supabase
        .from("loop_tasks")
        .select("title")
        .eq("user_id", user.id)
        .gte("for_date", fiveDaysAgo.toISOString().split("T")[0]);
      
      const recentTitles = (recentData || []).map(r => r.title);

      // Generate new tasks
      setGenerating(true);
      const generated = await generateDailyTasks(user.id, { 
        recentTitles,
        categoryScores 
      });

      const rows = generated.map(t => ({
        ...t,
        user_id: user.id,
        for_date: today,
        done: false,
        skipped: false,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("loop_tasks")
        .insert(rows)
        .select();

      if (insertError) throw insertError;
      setTasks(inserted || []);
    } catch (err) {
      console.error("Failed to load or generate tasks:", err);
      // Fallback: Show generated tasks even if saving failed
      try {
        const fallbackTasks = await generateDailyTasks(user.id);
        setTasks(fallbackTasks.map((t, i) => ({ ...t, id: `fb-${Date.now()}-${i}` })));
      } catch (e) {
        setTasks([]);
      }
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const done = !task.done;
    const completedAt = done ? new Date().toISOString() : null;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, done, completed_at: completedAt } : t
    ));

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id);
    if (!isUUID) return; // Silent return for demo mode local state only

    const { error } = await supabase
      .from("loop_tasks")
      .update({
        done,
        completed_at: completedAt,
      })
      .eq("id", id);
    
    if (error) {
      // Revert if error
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, done: !done, completed_at: task.completed_at } : t
      ));
    }
  }, [tasks]);

  const skipTask = useCallback(async (id) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, skipped: true } : t
    ));
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id);
    if (isUUID) {
      await supabase
        .from("loop_tasks")
        .update({ skipped: true })
        .eq("id", id);
    }
  }, []);

  const replaceTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Generate a single lighter replacement
    const context = { recentTitles: tasks.map(t => t.title) };
    const { getFallbackSingle } = await import("../data/taskFallbackPool");
    const replacement = getFallbackSingle(task.category, "light", context);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id);
    if (!isUUID) {
      setTasks(prev => prev.map(t => t.id === id ? {
        ...t,
        title: replacement.title,
        subtitle: replacement.subtitle,
        why: replacement.why,
        duration_minutes: replacement.duration_minutes,
        intensity: "light",
        ai_generated: false,
      } : t));
      return;
    }

    const { data, error } = await supabase
      .from("loop_tasks")
      .update({
        title: replacement.title,
        subtitle: replacement.subtitle,
        why: replacement.why,
        duration_minutes: replacement.duration_minutes,
        intensity: "light",
        ai_generated: false,
      })
      .eq("id", id)
      .select()
      .single();

    if (data && !error) {
      setTasks(prev => prev.map(t => t.id === id ? data : t));
    }
  }, [tasks]);

  return {
    tasks, loading, generating,
    toggleTask, skipTask, replaceTask,
    refresh: loadOrGenerate,
    today,
  };
}
