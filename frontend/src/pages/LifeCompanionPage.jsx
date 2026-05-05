import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/tokens.css";
import Icon from "../components/Icon";
import ModeSelector from "../components/companion/ModeSelector";
import CompanionChatPanel from "../components/companion/CompanionChatPanel";
import ConversationSidebar from "../components/companion/ConversationSidebar";
import { useLifeCompanion } from "../hooks/useLifeCompanion";
import { COMPANION_MODES } from "../data/companionModes";

const REAL_WORLD_STORAGE_KEY = "lifeProject.lifeCompanion.realWorldAction";

export default function LifeCompanionPage() {
  const navigate = useNavigate();
  const {
    conversations,
    selectedConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    loadConversations,
    getStoredSelectedConversationId,
    loadMessages,
    deleteConversation,
    sendMessage,
    startNewChat,
    appendLocalAssistant,
    clearError,
  } = useLifeCompanion();
  const [activeMode, setActiveMode] = useState("understand_me");
  const [input, setInput] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const userInteractedBeforeHydrationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const hydrateConversations = async () => {
      const loadedConversations = await loadConversations();
      if (cancelled || userInteractedBeforeHydrationRef.current) return;

      const storedConversationId = getStoredSelectedConversationId();
      const conversationToOpen = loadedConversations.find(
        (conversation) => conversation.id === storedConversationId
      ) || loadedConversations[0];

      if (conversationToOpen?.id) {
        await loadMessages(conversationToOpen.id);
      } else {
        startNewChat();
      }
    };

    hydrateConversations();

    return () => {
      cancelled = true;
    };
  }, [getStoredSelectedConversationId, loadConversations, loadMessages, startNewChat]);

  const activeModeLabel = useMemo(() => (
    COMPANION_MODES.find((mode) => mode.id === activeMode)?.label || "Understand Me"
  ), [activeMode]);

  const handleNewChat = () => {
    userInteractedBeforeHydrationRef.current = true;
    startNewChat();
    setMobileSidebarOpen(false);
  };

  const handleSelectConversation = async (conversationId) => {
    userInteractedBeforeHydrationRef.current = true;
    setMobileSidebarOpen(false);
    if (!conversationId || conversationId === selectedConversationId) return;
    await loadMessages(conversationId);
  };

  const handleDeleteConversation = async (conversationId) => {
    userInteractedBeforeHydrationRef.current = true;
    await deleteConversation(conversationId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanInput = input.trim();
    if (!cleanInput || sending || loadingMessages) return;

    userInteractedBeforeHydrationRef.current = true;
    setInput("");
    clearError();

    await sendMessage({
      conversationId: selectedConversationId,
      mode: activeMode,
      message: cleanInput,
    });
  };

  const handleSuggestedAction = (action) => {
    if (!action) return;

    if (action.type === "real_world_action") {
      window.localStorage.setItem(
        REAL_WORLD_STORAGE_KEY,
        JSON.stringify({
          action,
          saved_at: new Date().toISOString(),
        })
      );
      appendLocalAssistant({
        status: "success",
        reply: "Carried for today. Keep it small enough to do away from the screen.",
        tone: "grounded",
        suggested_action: { type: "none", label: "No action", route: null },
        safety: { risk_level: "none", message: null },
      });
      return;
    }

    if (action.route) {
      navigate(action.route);
    }
  };

  return (
    <main className="life-companion-page">
      <div className="companion-background" aria-hidden="true" />

      <section className="companion-shell">
        <header className="companion-header">
          <button
            type="button"
            className="companion-back"
            onClick={() => navigate("/dashboard")}
          >
            <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
            Dashboard
          </button>

          <div>
            <p>Life Companion</p>
            <h1>A quiet place to speak, then move.</h1>
          </div>
        </header>

        <ModeSelector activeMode={activeMode} onChange={setActiveMode} />

        <button
          type="button"
          className="companion-mobile-chat-toggle"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Icon name="sparkle" size={15} />
          <span>Recent chats</span>
        </button>

        <div
          className={`companion-sidebar-backdrop${mobileSidebarOpen ? " is-open" : ""}`}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />

        <section className="companion-workspace">
          <ConversationSidebar
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            loading={loadingConversations}
            mobileOpen={mobileSidebarOpen}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />

          <section className="companion-panel">
            <div className="companion-panel-header">
              <div>
                <p>Current mode</p>
                <h2>{activeModeLabel}</h2>
              </div>
              <span>{selectedConversationId ? "Saved chat" : "New chat"}</span>
            </div>

            <CompanionChatPanel
              messages={messages}
              loading={sending}
              loadingMessages={loadingMessages}
              onAction={handleSuggestedAction}
            />

            {error && (
              <div className="companion-error" role="status">
                {error}
              </div>
            )}

            <form className="companion-input-bar" onSubmit={handleSubmit}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={1200}
                placeholder="Say what is happening..."
                aria-label="Message Life Companion"
              />
              <button type="submit" disabled={sending || loadingMessages || !input.trim()}>
                <Icon name="arrow" size={17} />
              </button>
            </form>
          </section>
        </section>
      </section>

      <style>{`
        .life-companion-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: var(--bg);
          color: var(--text);
          position: relative;
          padding: clamp(18px, 4vw, 42px);
        }

        .companion-background {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(2, 8, 6, 0.72), rgba(2, 8, 6, 0.96)),
            radial-gradient(circle at 78% 12%, rgba(240, 165, 0, 0.12), transparent 32%),
            radial-gradient(circle at 12% 86%, rgba(46, 204, 113, 0.14), transparent 36%),
            url("/media/misty-lake.jpg");
          background-size: cover;
          background-position: center;
        }

        .companion-shell {
          position: relative;
          z-index: 1;
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .companion-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 20px;
        }

        .companion-header p,
        .companion-panel-header p,
        .companion-sidebar-top p,
        .companion-action-card p,
        .companion-safety-label {
          margin: 0 0 8px;
          color: rgba(126, 217, 154, 0.72);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .companion-header h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(34px, 6vw, 58px);
          font-weight: 500;
          line-height: 1.02;
          letter-spacing: 0;
          max-width: 680px;
        }

        .companion-back,
        .companion-mobile-chat-toggle,
        .companion-new-chat {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(232, 232, 227, 0.74);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 700;
          padding: 10px 14px;
          white-space: nowrap;
        }

        .companion-mode-selector {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .companion-mode-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          border: 1px solid rgba(126, 217, 154, 0.13);
          border-radius: var(--r-md);
          background: rgba(8, 18, 14, 0.72);
          color: rgba(232, 232, 227, 0.72);
          cursor: pointer;
          font-family: var(--font-body);
          padding: 13px;
          text-align: left;
          backdrop-filter: blur(18px);
        }

        .companion-mode-chip.is-active {
          border-color: rgba(126, 217, 154, 0.38);
          background: linear-gradient(145deg, rgba(22, 74, 45, 0.78), rgba(5, 16, 11, 0.78));
          color: var(--text);
          box-shadow: 0 12px 34px rgba(46, 204, 113, 0.12);
        }

        .companion-mode-chip span {
          min-width: 0;
        }

        .companion-mode-chip strong,
        .companion-mode-chip small {
          display: block;
          overflow-wrap: anywhere;
        }

        .companion-mode-chip strong {
          font-size: 13px;
          line-height: 1.2;
        }

        .companion-mode-chip small {
          margin-top: 4px;
          color: rgba(232, 232, 227, 0.48);
          font-size: 11px;
          line-height: 1.2;
        }

        .companion-mobile-chat-toggle {
          display: none;
          margin: 0 0 12px;
          background: rgba(8, 18, 14, 0.82);
          color: rgba(232, 232, 227, 0.84);
        }

        .companion-workspace {
          display: grid;
          grid-template-columns: minmax(250px, 292px) minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
        }

        .companion-sidebar,
        .companion-panel {
          border: 1px solid rgba(126, 217, 154, 0.18);
          border-radius: var(--r-lg);
          background:
            radial-gradient(circle at 90% 6%, rgba(240, 165, 0, 0.1), transparent 30%),
            linear-gradient(145deg, rgba(7, 18, 14, 0.9), rgba(2, 8, 6, 0.82));
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42), var(--shadow-glow);
          backdrop-filter: blur(24px);
          overflow: hidden;
        }

        .companion-sidebar {
          min-height: min(680px, calc(100vh - 190px));
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          padding: 16px;
        }

        .companion-sidebar-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .companion-sidebar-top h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 25px;
          font-weight: 500;
          line-height: 1.05;
        }

        .companion-sidebar-close {
          display: none;
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(232, 232, 227, 0.74);
          cursor: pointer;
        }

        .companion-new-chat {
          width: 100%;
          justify-content: center;
          border-color: rgba(126, 217, 154, 0.22);
          background: rgba(46, 204, 113, 0.1);
          color: rgba(224, 255, 234, 0.92);
        }

        .companion-conversation-list {
          min-height: 0;
          overflow-y: auto;
          margin-top: 14px;
          padding-right: 2px;
        }

        .companion-conversation-empty {
          border: 1px solid rgba(126, 217, 154, 0.1);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          color: rgba(232, 232, 227, 0.54);
          font-size: 13px;
          line-height: 1.45;
          padding: 12px;
        }

        .companion-conversation-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(126, 217, 154, 0.1);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          margin-bottom: 8px;
          transition: border-color 160ms ease, background 160ms ease;
        }

        .companion-conversation-item.is-active {
          border-color: rgba(126, 217, 154, 0.34);
          background: rgba(46, 204, 113, 0.1);
        }

        .companion-conversation-select,
        .companion-conversation-delete {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-family: var(--font-body);
        }

        .companion-conversation-select {
          min-width: 0;
          padding: 12px 0 12px 12px;
          text-align: left;
        }

        .companion-conversation-copy {
          display: block;
          min-width: 0;
        }

        .companion-conversation-copy strong,
        .companion-conversation-copy small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .companion-conversation-copy strong {
          color: rgba(232, 232, 227, 0.86);
          font-size: 13px;
          line-height: 1.25;
        }

        .companion-conversation-copy small {
          color: rgba(232, 232, 227, 0.42);
          font-size: 11px;
          margin-top: 5px;
        }

        .companion-conversation-delete {
          margin-right: 8px;
          border: 1px solid rgba(240, 165, 0, 0.16);
          border-radius: 999px;
          color: rgba(255, 229, 178, 0.68);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.8px;
          padding: 7px 8px;
          text-transform: uppercase;
        }

        .companion-panel {
          min-height: min(680px, calc(100vh - 190px));
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto auto;
        }

        .companion-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 20px 22px;
          border-bottom: 1px solid rgba(126, 217, 154, 0.1);
        }

        .companion-panel-header h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 500;
          line-height: 1.1;
        }

        .companion-panel-header span {
          flex: 0 0 auto;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: rgba(232, 232, 227, 0.52);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          padding: 8px 10px;
          text-transform: uppercase;
        }

        .companion-chat-panel {
          min-height: 0;
          overflow-y: auto;
          padding: 20px;
        }

        .companion-message-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 14px;
        }

        .companion-message-row.is-user {
          justify-content: flex-end;
        }

        .companion-message-bubble {
          width: min(680px, 88%);
          border: 1px solid rgba(126, 217, 154, 0.13);
          border-radius: var(--r-md);
          background: rgba(255, 255, 255, 0.045);
          color: rgba(232, 232, 227, 0.78);
          padding: 16px;
        }

        .companion-message-bubble.user {
          border-color: rgba(46, 204, 113, 0.22);
          background: rgba(46, 204, 113, 0.1);
          color: var(--text);
        }

        .companion-message-bubble.serious {
          border-color: rgba(240, 165, 0, 0.28);
          background: rgba(240, 165, 0, 0.08);
        }

        .companion-message-bubble.loading {
          width: auto;
          color: rgba(232, 232, 227, 0.56);
        }

        .companion-message-bubble p {
          margin: 0;
          font-size: 15px;
          line-height: 1.65;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .companion-action-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 14px;
          padding: 14px;
          border: 1px solid rgba(240, 165, 0, 0.24);
          border-radius: 14px;
          background: rgba(240, 165, 0, 0.08);
        }

        .companion-action-card h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 500;
          line-height: 1.1;
        }

        .companion-action-card button,
        .companion-input-bar button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(240, 165, 0, 0.28);
          border-radius: 999px;
          background: rgba(240, 165, 0, 0.15);
          color: rgba(255, 229, 178, 0.94);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 800;
          padding: 11px 14px;
          white-space: nowrap;
        }

        .companion-error {
          margin: 0 20px 14px;
          border: 1px solid rgba(240, 165, 0, 0.22);
          border-radius: 12px;
          background: rgba(240, 165, 0, 0.08);
          color: rgba(255, 229, 178, 0.88);
          font-size: 13px;
          line-height: 1.45;
          padding: 12px 14px;
        }

        .companion-input-bar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          padding: 16px;
          border-top: 1px solid rgba(126, 217, 154, 0.1);
          background: rgba(2, 8, 6, 0.62);
        }

        .companion-input-bar textarea {
          width: 100%;
          min-height: 52px;
          max-height: 140px;
          resize: vertical;
          border: 1px solid rgba(126, 217, 154, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.055);
          color: var(--text);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.45;
          outline: none;
          padding: 15px 16px;
        }

        .companion-input-bar textarea::placeholder {
          color: rgba(232, 232, 227, 0.36);
        }

        .companion-input-bar button {
          width: 52px;
          height: 52px;
          padding: 0;
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          color: #03110b;
          border-color: rgba(46, 204, 113, 0.42);
        }

        .companion-input-bar button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .companion-sidebar-backdrop {
          display: none;
        }

        @media (max-width: 980px) {
          .companion-mode-selector {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .companion-header {
            flex-direction: column;
          }

          .companion-workspace {
            grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
          }
        }

        @media (max-width: 760px) {
          .life-companion-page {
            padding: 12px;
          }

          .companion-mode-selector {
            grid-template-columns: 1fr;
          }

          .companion-mobile-chat-toggle {
            display: inline-flex;
          }

          .companion-workspace {
            display: block;
          }

          .companion-sidebar {
            position: fixed;
            z-index: 6;
            top: 12px;
            bottom: 12px;
            left: 12px;
            width: min(330px, calc(100vw - 34px));
            min-height: 0;
            transform: translateX(calc(-100% - 28px));
            transition: transform 180ms ease;
          }

          .companion-sidebar.is-open {
            transform: translateX(0);
          }

          .companion-sidebar-close {
            display: inline-flex;
          }

          .companion-sidebar-backdrop.is-open {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 5;
            background: rgba(0, 0, 0, 0.52);
          }

          .companion-panel {
            min-height: calc(100vh - 286px);
            border-radius: 18px;
          }

          .companion-panel-header {
            flex-direction: column;
          }

          .companion-message-bubble {
            width: 94%;
          }

          .companion-action-card {
            align-items: stretch;
            flex-direction: column;
          }

          .companion-action-card button {
            width: 100%;
            white-space: normal;
          }
        }
      `}</style>
    </main>
  );
}
