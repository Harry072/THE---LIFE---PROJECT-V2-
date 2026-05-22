import Icon from "../Icon";

export default function SuggestedActionCard({ action, onAction }) {
  if (!action || action.type === "none") return null;

  return (
    <aside className="companion-action-card">
      <button type="button" onClick={() => onAction?.(action)}>
        <span>{action.label}</span>
        <Icon name="arrow" size={14} />
      </button>
    </aside>
  );
}
