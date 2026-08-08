import { useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";

export const getLocalDate = () => new Date().toLocaleDateString("en-CA");
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
  // Memoizes the in-flight/resolved check itself (not just a "did we start"
  // boolean) so any repeat call — including React StrictMode's dev-only
  // double-invoke of this effect — awaits the SAME real result instead of
  // racing past it with a premature guard-clipped answer. Callers that need
  // the definitive pending status (the continuation chain's defer) depend
  // on this being correct under concurrent calls, not just a single call.
  const checkPromiseRef = useRef(null);

  const checkForReveal = useCallback(() => {
    if (checkPromiseRef.current) return checkPromiseRef.current;

    if (isDismissedToday()) {
      checkPromiseRef.current = Promise.resolve(false);
      return checkPromiseRef.current;
    }

    checkPromiseRef.current = (async () => {
      try {
        const accessToken = await getSupabaseOrAppAccessToken(supabase);
        if (!accessToken) return false;

        const response = await fetch(`${API_BASE_URL}/api/reflections/pattern-reveal`, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        if (!response.ok) return false;

        const payload = await response.json().catch(() => null);
        if (payload?.pending) {
          setPending(true);
          setDescription(payload.description ?? null);
          setQuestion(payload.question ?? null);
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error checking pattern reveal:", err);
        return false;
      }
    })();

    return checkPromiseRef.current;
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
