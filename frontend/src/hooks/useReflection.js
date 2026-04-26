import { useState, useEffect, useCallback } from "react";
import { getDailyReflectionPrompts } from "../data/reflectionQuestions";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";

const MAX_REFLECTION_ANSWER_LENGTH = 2500;

const getLocalDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const limitAnswer = (value) => {
  if (value == null) return "";
  return String(value).slice(0, MAX_REFLECTION_ANSWER_LENGTH);
};

const normalizeQuestionItem = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const prompt = typeof item.prompt === "string" ? item.prompt : item.q;
  if (typeof prompt !== "string" || !prompt.trim()) return null;

  return {
    prompt,
    answer: limitAnswer(item.answer ?? item.a ?? ""),
  };
};

const normalizeSavedQuestions = (items, fallbackPrompts) => {
  const safeFallbackPrompts = fallbackPrompts.slice(0, 3);
  const normalizedItems = safeFallbackPrompts.map((fallbackPrompt, index) => {
    const saved = Array.isArray(items) ? normalizeQuestionItem(items[index]) : null;
    return saved ?? { prompt: fallbackPrompt, answer: "" };
  });

  return {
    questions: normalizedItems.map((item) => item.prompt),
    answers: normalizedItems.reduce((nextAnswers, item, index) => {
      nextAnswers[index] = item.answer;
      return nextAnswers;
    }, {}),
  };
};

const logSupabaseError = (label, error) => {
  console.error(label, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
};

export function useReflection() {
  const user = useUserStore((state) => state.user);
  const [today] = useState(getLocalDate);
  const [questions, setQuestions] = useState(() =>
    getDailyReflectionPrompts(today)
  );
  const [answers, setAnswers] = useState({});
  const [selectedMood, setSelectedMood] = useState(null);
  const [savedToday, setSavedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [recentReflections, setRecentReflections] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState("");

  const hasContent = Object.values(answers).some(
    (answer) => answer && answer.trim().length > 0
  );

  const loadToday = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fallbackPrompts = getDailyReflectionPrompts(today);
    setLoading(true);
    setStatusMessage("");
    setStatusTone("neutral");

    try {
      const { data: existing, error } = await supabase
        .from("reflections")
        .select("id, user_id, for_date, questions, mood")
        .eq("user_id", user.id)
        .eq("for_date", today)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        const normalized = normalizeSavedQuestions(
          existing.questions,
          fallbackPrompts
        );
        setQuestions(normalized.questions);
        setAnswers(normalized.answers);
        setSelectedMood(existing.mood || null);
        setSavedToday(true);
      } else {
        setQuestions(fallbackPrompts);
        setAnswers({});
        setSelectedMood(null);
        setSavedToday(false);
      }
    } catch (error) {
      logSupabaseError("Night reflection load failed", error);
      setStatusMessage("We couldn’t load tonight’s reflection. Your writing space is still here.");
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }, [today, user]);

  const loadRecentReflections = useCallback(async () => {
    if (!user) {
      setRecentReflections([]);
      return;
    }

    setArchiveLoading(true);
    setArchiveError("");

    try {
      const { data, error } = await supabase
        .from("reflections")
        .select("id, user_id, for_date, mood, questions, created_at, updated_at")
        .eq("user_id", user.id)
        .order("for_date", { ascending: false })
        .limit(14);

      if (error) throw error;

      setRecentReflections(data || []);
    } catch (error) {
      logSupabaseError("Night reflection archive load failed", error);
      setArchiveError("We couldn’t load your archive just now.");
    } finally {
      setArchiveLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadToday();
    loadRecentReflections();
  }, [loadRecentReflections, loadToday]);

  const setAnswer = useCallback((index, value) => {
    setAnswers((prev) => ({ ...prev, [index]: limitAnswer(value) }));
    setStatusMessage("");
    setStatusTone("neutral");
  }, []);

  const handleMoodChange = useCallback((mood) => {
    setSelectedMood(mood);
    setStatusMessage("");
    setStatusTone("neutral");
  }, []);

  const save = useCallback(async () => {
    if (!user || saving || !hasContent) return { success: false };

    const wasSavedToday = savedToday;
    const payload = {
      user_id: user.id,
      for_date: today,
      mood: selectedMood || null,
      questions: questions.map((question, index) => ({
        prompt: question,
        answer: limitAnswer(answers[index]).trim(),
      })),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    setStatusMessage("Saving your reflection...");
    setStatusTone("neutral");

    try {
      const { data, error } = await supabase
        .from("reflections")
        .upsert(payload, { onConflict: "user_id,for_date" })
        .select()
        .single();

      if (error) throw error;

      const normalized = normalizeSavedQuestions(data?.questions, questions);
      setQuestions(normalized.questions);
      setAnswers(normalized.answers);
      setSelectedMood(data?.mood || selectedMood || null);
      setSavedToday(true);
      setStatusMessage(
        wasSavedToday ? "Tonight’s reflection was updated." : "Saved for tonight."
      );
      setStatusTone("success");
      await loadRecentReflections();
      return { success: true, data };
    } catch (error) {
      logSupabaseError("Night reflection save failed", error);
      setStatusMessage("We couldn’t save just now. Your words are still here.");
      setStatusTone("error");
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  }, [
    answers,
    hasContent,
    loadRecentReflections,
    questions,
    savedToday,
    saving,
    selectedMood,
    today,
    user,
  ]);

  return {
    questions,
    answers,
    setAnswer,
    selectedMood,
    setSelectedMood: handleMoodChange,
    savedToday,
    loading,
    saving,
    save,
    statusMessage,
    statusTone,
    hasContent,
    recentReflections,
    archiveLoading,
    archiveError,
    loadRecentReflections,
    today,
  };
}
