import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";

export function useLoopTasks() {
  const user = useUserStore((state) => state.user);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Convert today's local date to YYYY-MM-DD. 
  // This prevents the afternoon UTC offset bug where tasks disappear.
  const getLocalDate = () => {
    // en-CA locale natively formats the date as YYYY-MM-DD using the user's local timezone
    return new Date().toLocaleDateString('en-CA');
  };

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const for_date = getLocalDate();
      const res = await fetch(`http://127.0.0.1:8000/api/get-loop-tasks?for_date=${for_date}&user_id=${user.id}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err.message || "Failed to load tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generateTasks = useCallback(async (context = {}) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const for_date = getLocalDate();
      const payload = { 
        user_id: user.id, 
        local_date: for_date, 
        context: context 
      };
      
      const res = await fetch(`http://127.0.0.1:8000/api/generate-loop-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      
      const data = await res.json();
      // Aggressively refetch from the database to synchronize the UI state
      await fetchTasks();
    } catch (err) {
      console.error("Error generating tasks:", err);
      setError(err.message || "AI failed to generate tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, fetchTasks]);

  const toggleTask = useCallback(async (taskId) => {
    if (!user) return;
    
    // Optimistic UI update for immediate response
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`http://127.0.0.1:8000/api/toggle-task/${taskId}`, {
        method: "POST",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      // Sync exact DB state if optimistic update was wrong
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: data.done } : t));
    } catch (err) {
      console.error("Error toggling task:", err);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
      setError("Failed to update task.");
    }
  }, [user]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    generateTasks,
    toggleTask
  };
}