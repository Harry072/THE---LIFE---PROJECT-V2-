import Icon from "../Icon";

export default function SuggestedActionCard({ action, onAction }) {
  if (!action || action.type === "none") return null;

  return (
    <article className="companion-action-card">
      <div>
        <p>Suggested action</p>
        <h3>{action.label}</h3>
      </div>
      <button type="button" onClick={() => onAction?.(action)}>
        <span>{action.label}</span>
        <Icon name="arrow" size={15} />
      </button>
    </article>
  );
}
