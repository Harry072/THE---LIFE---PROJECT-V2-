import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";

const REFLECTION_QUESTIONS = [
  "What stayed with you today?",
  "What did you carry quietly today?",
  "What is one small thing you want to do differently tomorrow?",
];

const getLocalDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const normalizeAnswers = (items) => {
  const nextAnswers = {};

  REFLECTION_QUESTIONS.forEach((question, index) => {
    const saved = Array.isArray(items)
      ? items.find((item) => item?.q === question) ?? items[index]
      : null;

    nextAnswers[index] = typeof saved === "string" ? "" : saved?.a ?? "";
  });

  return nextAnswers;
};

export function useReflection() {
  const user = useUserStore((state) => state.user);
  const today = getLocalDate();

  const [questions] = useState(REFLECTION_QUESTIONS);
  const [answers, setAnswers] = useState({});
  const [selectedMood, setSelectedMood] = useState(null);
  const [savedToday, setSavedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pastReflections, setPastReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");

  const loadPast = useCallback(async () => {
    if (!user) {
      setPastReflections([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("reflections")
        .select("id, for_date, questions, mood, insight_text")
        .eq("user_id", user.id)
        .order("for_date", { ascending: false })
        .limit(14);

      if (error) throw error;
      setPastReflections(data || []);
    } catch (error) {
      console.error("Error loading past reflections:", error);
      setPastReflections([]);
    }
  }, [user]);

  const loadToday = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSaveError("");

    try {
      const { data: existing, error } = await supabase
        .from("reflections")
        .select("id, user_id, for_date, questions, mood")
        .eq("user_id", user.id)
        .eq("for_date", today)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        setAnswers(normalizeAnswers(existing.questions));
        setSelectedMood(existing.mood || null);
        setSavedToday(true);
      } else {
        setAnswers({});
        setSelectedMood(null);
        setSavedToday(false);
      }
    } catch (error) {
      console.error("Error loading today's reflection:", error);
      setSaveError("We could not load your reflection yet. Your writing space is still here.");
    } finally {
      setLoading(false);
    }
  }, [today, user]);

  useEffect(() => {
    loadToday();
    loadPast();
  }, [loadPast, loadToday]);

  const setAnswer = useCallback((index, value) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
    setSaveError("");
  }, []);

  const save = useCallback(async () => {
    if (!user || saving) return { success: false };

    setSaving(true);
    setSaveError("");

    const payload = {
      user_id: user.id,
      for_date: today,
      mood: selectedMood || null,
      questions: REFLECTION_QUESTIONS.map((question, index) => ({
        q: question,
        a: (answers[index] || "").trim(),
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
      await loadPast();
      return { success: true };
    } catch (error) {
      console.error("Save error:", error);
      setSaveError("We could not save this just now. Your words are still here.");
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  }, [answers, loadPast, saving, selectedMood, today, user]);

  const hasContent = Object.values(answers).some(
    (answer) => answer && answer.trim().length > 0
  );

  return {
    questions,
    answers,
    setAnswer,
    selectedMood,
    setSelectedMood,
    savedToday,
    saving,
    save,
    saveError,
    pastReflections,
    loading,
    hasContent,
    today,
  };
}
