import { useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";

const getLocalDate = () => new Date().toLocaleDateString("en-CA");
const dismissKey = () => `pattern_reveal_dismissed_${getLocalDate()}`;

const isDismissedToday = () => {
  try {
    return localStorage.getItem(dismissKey()) === "1";
  } catch {
    return false;
  }
};

export function usePatternReveal() {
  const [pending, setPending] = useState(false);
  const [description, setDescription] = useState(null);
  const [question, setQuestion] = useState(null);
  const checkedRef = useRef(false);

  const checkForReveal = useCallback(async () => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (isDismissedToday()) return;

    try {
      const accessToken = await getSupabaseOrAppAccessToken(supabase);
      if (!accessToken) return;

      const response = await fetch(`${API_BASE_URL}/api/reflections/pattern-reveal`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (!response.ok) return;

      const payload = await response.json().catch(() => null);
      if (payload?.pending) {
        setPending(true);
        setDescription(payload.description ?? null);
        setQuestion(payload.question ?? null);
      }
    } catch (err) {
      console.error("Error checking pattern reveal:", err);
    }
  }, []);

  const markSeen = useCallback(async () => {
    setPending(false);
    try {
      const accessToken = await getSupabaseOrAppAccessToken(supabase);
      if (!accessToken) return;
      await fetch(`${API_BASE_URL}/api/reflections/pattern-reveal/seen`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.error("Error clearing pattern reveal:", err);
    }
  }, []);

  const dismissForToday = useCallback(() => {
    setPending(false);
    try {
      localStorage.setItem(dismissKey(), "1");
    } catch {
      // localStorage unavailable — dismissal just won't persist across reload, non-fatal
    }
  }, []);

  return { pending, description, question, checkForReveal, markSeen, dismissForToday };
}
