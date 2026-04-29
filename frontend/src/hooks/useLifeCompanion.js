import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAppState } from "../contexts/AppStateContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export function useLifeCompanion() {
  const { user } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendMessage = useCallback(async ({ mode, message }) => {
    if (!user?.id) {
      const messageText = "Sign in again to use Life Companion.";
      setError(messageText);
      return { status: "error", error: messageText };
    }

    setLoading(true);
    setError("");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(`${API_BASE_URL}/api/life-companion/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          mode,
          message,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || `Server returned ${response.status}`);
      }

      return payload;
    } catch (requestError) {
      const messageText = requestError?.message || "Life Companion could not respond right now.";
      setError(messageText);
      return { status: "error", error: messageText };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const clearError = useCallback(() => setError(""), []);

  return {
    loading,
    error,
    sendMessage,
    clearError,
  };
}
