import SuggestedActionCard from "./SuggestedActionCard";

export default function CompanionMessageBubble({ message, onAction }) {
  const isUser = message.role === "user";

  return (
    <div className={`companion-message-row${isUser ? " is-user" : ""}`}>
      <article className={`companion-message-bubble ${isUser ? "user" : "assistant"} ${message.tone || ""}`}>
        {!isUser && message.status === "safety" && (
          <p className="companion-safety-label">Safety first</p>
        )}
        <p>{message.content}</p>
        {!isUser && (
          <SuggestedActionCard action={message.suggested_action} onAction={onAction} />
        )}
      </article>
    </div>
  );
}
