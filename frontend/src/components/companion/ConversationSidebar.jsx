import Icon from "../Icon";

const formatConversationTime = (value) => {
  if (!value) return "";
  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.getTime())) return "";

  const diffMs = Date.now() - updatedAt.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;

  return updatedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export default function ConversationSidebar({
  conversations,
  selectedConversationId,
  loading,
  mobileOpen,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onCloseMobile,
}) {
  return (
    <aside className={`companion-sidebar${mobileOpen ? " is-open" : ""}`}>
      <div className="companion-sidebar-top">
        <div>
          <p>Conversations</p>
          <h2>Recent chats</h2>
        </div>
        <button
          type="button"
          className="companion-sidebar-close"
          onClick={onCloseMobile}
          aria-label="Close conversations"
        >
          <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      <button type="button" className="companion-new-chat" onClick={onNewChat}>
        <Icon name="plus" size={16} />
        <span>New Chat</span>
      </button>

      <div className="companion-conversation-list" aria-busy={loading}>
        {loading && (
          <div className="companion-conversation-empty">
            Opening the archive...
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="companion-conversation-empty">
            No saved conversations yet.
          </div>
        )}

        {!loading && conversations.map((conversation) => {
          const active = conversation.id === selectedConversationId;
          return (
            <div
              key={conversation.id}
              className={`companion-conversation-item${active ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="companion-conversation-select"
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className="companion-conversation-copy">
                  <strong>{conversation.title || "New conversation"}</strong>
                  <small>
                    {formatConversationTime(conversation.updated_at || conversation.created_at)}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="companion-conversation-delete"
                aria-label={`Delete ${conversation.title || "conversation"}`}
                onClick={() => onDeleteConversation(conversation.id)}
              >
                <span aria-hidden="true">Delete</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
