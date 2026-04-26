import { CheckCircle2, RotateCcw } from "lucide-react";

const FEELINGS = ["Clearer", "Softer", "Still heavy", "Focused"];

export default function PostSessionCheckin({
  selectedFeeling,
  onSelectFeeling,
  onReturn,
  onClose,
}) {
  return (
    <div className="reset-checkin">
      <div className="reset-checkin-icon">
        <CheckCircle2 size={24} aria-hidden="true" />
      </div>
      <h2>How do you feel now?</h2>
      <div className="reset-feeling-grid">
        {FEELINGS.map((feeling) => (
          <button
            key={feeling}
            type="button"
            className={selectedFeeling === feeling ? "is-selected" : ""}
            onClick={() => onSelectFeeling(feeling)}
          >
            {feeling}
          </button>
        ))}
      </div>

      {selectedFeeling ? (
        <div className="reset-next-action">
          <p>Return to one useful action.</p>
          <button type="button" className="reset-primary-action" onClick={onReturn}>
            Open The Loop
          </button>
        </div>
      ) : null}

      <button type="button" className="reset-quiet-action" onClick={onClose}>
        <RotateCcw size={15} aria-hidden="true" />
        Back to Reset Space
      </button>
    </div>
  );
}
