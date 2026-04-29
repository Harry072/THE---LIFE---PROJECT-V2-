import Icon from "../Icon";
import { COMPANION_MODES } from "../../data/companionModes";

export default function ModeSelector({ activeMode, onChange }) {
  return (
    <div className="companion-mode-selector" role="tablist" aria-label="Life Companion modes">
      {COMPANION_MODES.map((mode) => {
        const active = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            className={`companion-mode-chip${active ? " is-active" : ""}`}
            onClick={() => onChange?.(mode.id)}
            role="tab"
            aria-selected={active}
          >
            <Icon name={mode.icon} size={16} />
            <span>
              <strong>{mode.label}</strong>
              <small>{mode.detail}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
