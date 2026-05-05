import { useCallback, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAppState } from "../contexts/AppStateContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const EMPTY_ACTION = { type: "none", label: "No action", route: null };
const EMPTY_SAFETY = { risk_level: "none", message: null };
const SELECTED_CONVERSATION_KEY_PREFIX = "lifeProject.lifeCompanion.selectedConversation.";

const createMessageId = () => (
  typeof window !== "undefined" && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
);

const createWelcomeMessage = () => ({
  id: "welcome",
  role: "assistant",
  content: "I am here for one useful step at a time. Choose a mode, say what is happening, and I will keep it grounded.",
  tone: "grounded",
  suggested_action: EMPTY_ACTION,
  safety: EMPTY_SAFETY,
});

const compactText = (value, maxChars) => {
  const compacted = String(value || "").trim().replace(/\s+/g, " ");
  if (compacted.length <= maxChars) return compacted;
  return `${compacted.slice(0, maxChars - 3).trim()}...`;
};

const deriveLocalTitle = (message) => compactText(message, 56) || "New conversation";

const normalizeConversation = (conversation) => ({
  ...conversation,
  title: compactText(conversation?.title, 80) || "New conversation",
  last_message_preview: compactText(conversation?.last_message_preview, 120),
});

const sortConversations = (items) => (
  [...items].sort((left, right) => (
    new Date(right.updated_at || right.created_at || 0).getTime()
    - new Date(left.updated_at || left.created_at || 0).getTime()
  ))
);

const mapPersistedMessage = (row) => ({
  id: row.id || createMessageId(),
  role: row.role,
  content: row.content || "",
  tone: row.tone || "grounded",
  suggested_action: row.suggested_action_json || EMPTY_ACTION,
  safety: {
    risk_level: row.risk_level || "none",
    message: null,
  },
  created_at: row.created_at,
});

export function useLifeCompanion() {
  const { user } = useAppState();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const sendingRef = useRef(false);

  const getAccessToken = useCallback(async () => {
    if (!user?.id) {
      throw new Error("Sign in again to use Life Companion.");
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (sessionError || !accessToken) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    return accessToken;
  }, [user?.id]);

  const requestCompanion = useCallback(async (path, options = {}) => {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || `Server returned ${response.status}`);
    }

    return payload;
  }, [getAccessToken]);

  const upsertConversation = useCallback((conversation) => {
    if (!conversation?.id) return;
    const normalized = normalizeConversation(conversation);
    setConversations((current) => sortConversations([
      normalized,
      ...current.filter((item) => item.id !== normalized.id),
    ]));
  }, []);

  const getStoredSelectedConversationId = useCallback(() => {
    if (!user?.id || typeof window === "undefined") return null;
    return window.localStorage.getItem(`${SELECTED_CONVERSATION_KEY_PREFIX}${user.id}`);
  }, [user?.id]);

  const rememberSelectedConversationId = useCallback((conversationId) => {
    if (!user?.id || typeof window === "undefined") return;

    const storageKey = `${SELECTED_CONVERSATION_KEY_PREFIX}${user.id}`;
    if (conversationId) {
      window.localStorage.setItem(storageKey, conversationId);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }, [user?.id]);

  const selectConversationId = useCallback((conversationId) => {
    const nextConversationId = conversationId || null;
    setSelectedConversationId(nextConversationId);
    rememberSelectedConversationId(nextConversationId);
  }, [rememberSelectedConversationId]);

  const startNewChat = useCallback(() => {
    selectConversationId(null);
    setMessages([createWelcomeMessage()]);
    setError("");
  }, [selectConversationId]);

  const appendLocalAssistant = useCallback((payload) => {
    setMessages((current) => ([
      ...current,
      {
        id: createMessageId(),
        role: "assistant",
        content: payload?.reply || payload?.content || "",
        status: payload?.status,
        tone: payload?.tone || "grounded",
        suggested_action: payload?.suggested_action || EMPTY_ACTION,
        safety: payload?.safety || EMPTY_SAFETY,
        created_at: new Date().toISOString(),
      },
    ]));
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      startNewChat();
      return [];
    }

    setLoadingConversations(true);
    setError("");

    try {
      const payload = await requestCompanion("/api/life-companion/conversations");
      const rows = (payload?.conversations || []).map(normalizeConversation);
      const sortedRows = sortConversations(rows);
      setConversations(sortedRows);
      return sortedRows;
    } catch (requestError) {
      const messageText = requestError?.message || "Could not load conversations.";
      setError(messageText);
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, [requestCompanion, startNewChat, user?.id]);

  const createConversation = useCallback(async (title) => {
    setError("");

    try {
      const payload = await requestCompanion("/api/life-companion/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      const conversation = normalizeConversation(payload?.conversation || {});
      upsertConversation(conversation);
      selectConversationId(conversation.id);
      setMessages([createWelcomeMessage()]);
      return conversation;
    } catch (requestError) {
      const messageText = requestError?.message || "Could not create a conversation.";
      setError(messageText);
      return null;
    }
  }, [requestCompanion, selectConversationId, upsertConversation]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      startNewChat();
      return [];
    }

    setLoadingMessages(true);
    setError("");

    try {
      const payload = await requestCompanion(
        `/api/life-companion/conversations/${conversationId}/messages`
      );
      const loadedMessages = (payload?.messages || []).map(mapPersistedMessage);
      selectConversationId(conversationId);
      setMessages(loadedMessages.length ? loadedMessages : [createWelcomeMessage()]);
      return loadedMessages;
    } catch (requestError) {
      const messageText = requestError?.message || "Could not load that conversation.";
      setError(messageText);
      return [];
    } finally {
      setLoadingMessages(false);
    }
  }, [requestCompanion, selectConversationId, startNewChat]);

  const deleteConversation = useCallback(async (conversationId) => {
    if (!conversationId) return { status: "ignored" };

    setError("");

    try {
      const payload = await requestCompanion(
        `/api/life-companion/conversations/${conversationId}`,
        { method: "DELETE" }
      );
      const nextConversations = conversations.filter(
        (conversation) => conversation.id !== conversationId
      );
      setConversations(nextConversations);

      if (selectedConversationId === conversationId) {
        if (nextConversations[0]?.id) {
          await loadMessages(nextConversations[0].id);
        } else {
          startNewChat();
        }
      }

      return payload;
    } catch (requestError) {
      const messageText = requestError?.message || "Could not delete that conversation.";
      setError(messageText);
      return { status: "error", error: messageText };
    }
  }, [
    conversations,
    loadMessages,
    requestCompanion,
    selectedConversationId,
    startNewChat,
  ]);

  const sendMessage = useCallback(async ({ conversationId, mode, message }) => {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage || sendingRef.current) {
      return { status: "ignored" };
    }

    sendingRef.current = true;
    const activeConversationId = conversationId || selectedConversationId;
    const optimisticUserMessage = {
      id: createMessageId(),
      role: "user",
      content: cleanMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => {
      const withoutWelcome = current.length === 1 && current[0]?.id === "welcome"
        ? []
        : current;
      return [...withoutWelcome, optimisticUserMessage];
    });
    setSending(true);
    setError("");

    try {
      const payload = await requestCompanion("/api/life-companion/chat", {
        method: "POST",
        body: JSON.stringify({
          ...(activeConversationId ? { conversation_id: activeConversationId } : {}),
          mode,
          message: cleanMessage,
        }),
      });

      const assistantMessage = {
        id: createMessageId(),
        role: "assistant",
        content: payload.reply || "",
        status: payload.status,
        tone: payload.tone || "grounded",
        suggested_action: payload.suggested_action || EMPTY_ACTION,
        safety: payload.safety || EMPTY_SAFETY,
        created_at: new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);

      const responseConversationId = payload.conversation_id || activeConversationId;
      if (responseConversationId) {
        selectConversationId(responseConversationId);
      }

      if (payload.conversation?.id) {
        upsertConversation(payload.conversation);
      } else if (responseConversationId && payload.status !== "safety") {
        const existingConversation = conversations.find(
          (conversation) => conversation.id === responseConversationId
        );
        upsertConversation({
          ...(existingConversation || {}),
          id: responseConversationId,
          title: existingConversation?.title || deriveLocalTitle(cleanMessage),
          last_message_preview: compactText(payload.reply || cleanMessage, 120),
          updated_at: new Date().toISOString(),
          created_at: existingConversation?.created_at || new Date().toISOString(),
        });
      }

      return payload;
    } catch (requestError) {
      const messageText = requestError?.message || "Life Companion could not respond right now.";
      setError(messageText);
      setMessages((current) => ([
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: messageText || "I could not respond right now. Try one smaller step and come back in a moment.",
          status: "fallback",
          tone: "grounded",
          suggested_action: EMPTY_ACTION,
          safety: EMPTY_SAFETY,
        },
      ]));
      return { status: "error", error: messageText };
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [
    conversations,
    requestCompanion,
    selectConversationId,
    selectedConversationId,
    upsertConversation,
  ]);

  const clearError = useCallback(() => setError(""), []);

  return {
    conversations,
    selectedConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    loading: sending,
    error,
    loadConversations,
    createConversation,
    getStoredSelectedConversationId,
    loadMessages,
    deleteConversation,
    sendMessage,
    startNewChat,
    appendLocalAssistant,
    clearError,
  };
}
