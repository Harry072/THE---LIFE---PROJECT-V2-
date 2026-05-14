import SuggestedActionCard from "./SuggestedActionCard";

function CompanionSection({ section }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {section.title && (
        <p style={{
          margin: "0 0 6px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: "rgba(126,217,154,0.76)",
          fontFamily: "var(--font-body)",
        }}>
          {section.title}
        </p>
      )}
      {Array.isArray(section.items) ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {section.items.map((item, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>{item}</li>
          ))}
        </ul>
      ) : section.body ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{section.body}</p>
      ) : null}
    </div>
  );
}

export default function CompanionMessageBubble({ message, onAction }) {
  const isUser = message.role === "user";
  const hasSections = !isUser && Array.isArray(message.sections) && message.sections.length > 0;

  return (
    <div className={`companion-message-row${isUser ? " is-user" : ""}`}>
      <article className={`companion-message-bubble ${isUser ? "user" : "assistant"} ${message.tone || ""}`}>
        {!isUser && message.status === "safety" && (
          <p className="companion-safety-label">Safety first</p>
        )}
        {hasSections ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {message.sections.map((section, i) => (
              <CompanionSection key={i} section={section} />
            ))}
          </div>
        ) : (
          <p>{message.content}</p>
        )}
        {!isUser && (
          <SuggestedActionCard action={message.suggested_action} onAction={onAction} />
        )}
      </article>
    </div>
  );
}
