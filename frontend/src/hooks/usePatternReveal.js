import { useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";

export const getLocalDate = () => new Date().toLocaleDateString("en-CA");
const dismissKey = () => `pattern_reveal_dismissed_${getLocalDate()}`;

// Same value and mechanism as DASHBOARD_FETCH_TIMEOUT_MS (useDashboard.js) and
// SEASON_FETCH_TIMEOUT_MS (useContinuationChain.js). checkForReveal is awaited
// by TheLoopPage BEFORE evaluateCompletion, so an unguarded hang here stalls
// the continuation card even earlier than a hanging season fetch would --
// the try/catch below catches rejections, never a hang.
const REVEAL_FETCH_TIMEOUT_MS = 8000;

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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REVEAL_FETCH_TIMEOUT_MS);

        let response;
        try {
          response = await fetch(`${API_BASE_URL}/api/reflections/pattern-reveal`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
            signal: controller.signal,
          });
        } catch (error) {
          // false = "no reveal pending", so the chain proceeds normally rather
          // than deferring forever. Fail-safe: the worst case is a reveal the
          // user sees on a later completion, never a stalled card.
          if (error?.name === "AbortError") return false;
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REVEAL_FETCH_TIMEOUT_MS);
      try {
        await fetch(`${API_BASE_URL}/api/reflections/pattern-reveal/seen`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
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
