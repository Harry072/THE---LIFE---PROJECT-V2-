import { useEffect, useRef } from "react";
import CompanionMessageBubble from "./CompanionMessageBubble";

export default function CompanionChatPanel({
  messages,
  loading,
  loadingMessages = false,
  onAction,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="companion-chat-panel" aria-live="polite">
      {loadingMessages && (
        <div className="companion-message-row">
          <article className="companion-message-bubble assistant loading">
            <p>Opening conversation...</p>
          </article>
        </div>
      )}

      {!loadingMessages && messages.map((message) => (
        <CompanionMessageBubble
          key={message.id}
          message={message}
          onAction={onAction}
        />
      ))}

      {!loadingMessages && loading && (
        <div className="companion-message-row">
          <article className="companion-message-bubble assistant loading">
            <p>Listening carefully...</p>
          </article>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
