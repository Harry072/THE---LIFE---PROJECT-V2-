import { useState, useEffect, useCallback } from "react";
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

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");

  // activeEntryId === null means composing a brand new entry.
  // Otherwise it's the id of an existing entry being edited.
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [draftContent, setDraftContentState] = useState("");
  const [draftMood, setDraftMood] = useState(null);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");

  const hasContent = draftContent.trim().length > 0;

  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setArchiveError("");

    try {
      const { data, error } = await supabase
        .from("reflections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setEntries(data || []);
    } catch (error) {
      logSupabaseError("Journal entries load failed", error);
      setArchiveError("We couldn’t load your journal just now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const setDraftContent = useCallback((value) => {
    setDraftContentState(limitAnswer(value));
    setStatusMessage("");
    setStatusTone("neutral");
  }, []);

  const startNewEntry = useCallback(() => {
    setActiveEntryId(null);
    setDraftContentState("");
    setDraftMood(null);
    setStatusMessage("");
    setStatusTone("neutral");
  }, []);

  const startEditingEntry = useCallback((entry) => {
    if (!entry) return;
    setActiveEntryId(entry.id);
    setDraftContentState(limitAnswer(entry.content || ""));
    setDraftMood(entry.mood || null);
    setStatusMessage("");
    setStatusTone("neutral");
  }, []);

  const saveDraft = useCallback(async () => {
    if (!user || saving || !hasContent) return { success: false };

    setSaving(true);
    setStatusMessage("Saving privately...");
    setStatusTone("neutral");

    try {
      let data;
      let error;

      if (activeEntryId) {
        ({ data, error } = await supabase
          .from("reflections")
          .update({
            content: draftContent.trim(),
            mood: draftMood || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeEntryId)
          .eq("user_id", user.id)
          .select()
          .single());
      } else {
        ({ data, error } = await supabase
          .from("reflections")
          .insert({
            user_id: user.id,
            for_date: today,
            content: draftContent.trim(),
            mood: draftMood || null,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single());
      }

      if (error) throw error;

      setActiveEntryId(data?.id ?? activeEntryId);
      setStatusMessage("Entry saved privately.");
      setStatusTone("success");
      await loadEntries();
      return { success: true, data };
    } catch (error) {
      logSupabaseError("Journal entry save failed", error);
      setStatusMessage("Couldn’t save this entry. Your words are still here.");
      setStatusTone("error");
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  }, [activeEntryId, draftContent, draftMood, hasContent, loadEntries, saving, today, user]);

  return {
    entries,
    loading,
    archiveError,
    loadEntries,

    activeEntryId,
    draftContent,
    setDraftContent,
    draftMood,
    setDraftMood,
    startNewEntry,
    startEditingEntry,

    saving,
    saveDraft,
    statusMessage,
    statusTone,
    hasContent,
    today,
  };
}
