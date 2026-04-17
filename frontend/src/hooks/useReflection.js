import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";
import { getDailyQuestions } from "../data/reflectionQuestions";

export function useReflection() {
  const user = useUserStore(state => state.user);
  const today = new Date().toISOString().split("T")[0];

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [savedToday, setSavedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pastReflections, setPastReflections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load today's reflection and history
  useEffect(() => {
    if (!user) return;
    loadToday();
    loadPast();
  }, [user]);

  const loadToday = async () => {
    setLoading(true);

    try {
      // Check if already saved today
      const { data: existing, error } = await supabase
        .from("reflections")
        .select("*")
        .eq("user_id", user.id)
        .eq("for_date", today)
        .maybeSingle();

      if (existing) {
        // Already reflected today — load saved answers
        // Handle both spec formats: [{q, a}] or simple array
        const qs = Array.isArray(existing.questions) 
          ? existing.questions.map(q => typeof q === 'string' ? q : q.q)
          : [];
        
        const ans = {};
        if (Array.isArray(existing.questions)) {
          existing.questions.forEach((q, i) => {
            ans[i] = typeof q === 'string' ? "" : q.a;
          });
        }
        
        setQuestions(qs);
        setAnswers(ans);
        setSavedToday(true);
      } else {
        // Generate fresh questions for today
        const qs = await getQuestionsWithFallback(today);
        setQuestions(qs);
        setAnswers({});
        setSavedToday(false);
      }
    } catch (err) {
      console.error("Error loading today's reflection:", err);
    } finally {
      setLoading(false);
    }
  };

  // Try AI API, fall back to local curated pool
  const getQuestionsWithFallback = async (dateStr) => {
    try {
      // AI generation endpoint (conceptual/optional)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      const res = await fetch("/api/reflection-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const { questions } = await res.json();
        if (Array.isArray(questions) && questions.length >= 3)
          return questions.slice(0, 3);
      }
    } catch (e) {
      // Silently fall back to local pool on timeout/error
    }
    return getDailyQuestions(dateStr);
  };

  // Update a single answer in local state
  const setAnswer = useCallback((index, value) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
  }, []);

  // Save or update the reflection in Supabase
  const save = useCallback(async (mood) => {
    if (!user || saving) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      for_date: today,
      mood: mood || null,
      questions: questions.map((q, i) => ({
        q,
        a: (answers[i] || "").trim(),
      })),
    };

    try {
      const { error } = await supabase
        .from("reflections")
        .upsert(payload, {
          onConflict: "user_id,for_date",
        });

      if (error) throw error;

      setSavedToday(true);
      loadPast(); // Refresh history grid
      return { success: true };
    } catch (error) {
      console.error("Save error:", error);
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  }, [user, saving, today, questions, answers]);

  // Load the last 2 weeks of reflections
  const loadPast = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("reflections")
        .select("*")
        .eq("user_id", user.id)
        .order("for_date", { ascending: false })
        .limit(14);
      setPastReflections(data || []);
    } catch (err) {
      console.error("Error loading past reflections:", err);
    }
  };

  // Check if at least one question has text
  const hasContent = Object.values(answers).some(
    a => a && a.trim().length > 0
  );

  return {
    questions,
    answers,
    setAnswer,
    savedToday,
    saving,
    save,
    pastReflections,
    loading,
    hasContent,
    today,
  };
}
