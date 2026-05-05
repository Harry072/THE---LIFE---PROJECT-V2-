import { CheckCircle2, RotateCcw } from "lucide-react";

const FEELINGS = ["Clearer", "Softer", "Still heavy", "Focused"];
const REFLECTION_TAGS = [
  { value: "less_pressure", label: "Less pressure" },
  { value: "less_noise", label: "Less noise" },
  { value: "less_screen", label: "Less screen" },
  { value: "more_rest", label: "More rest" },
];

export default function PostSessionCheckin({
  selectedFeeling,
  onSelectFeeling,
  selectedReflectionTag,
  onSelectReflectionTag,
  onSubmit,
  isSaving = false,
  isSaved = false,
  saveError = "",
  onReturn,
  onClose,
}) {
  const canSubmit = Boolean(selectedFeeling && selectedReflectionTag && !isSaving);

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
        <>
          <h2 style={{ marginTop: 18 }}>What did your mind need less of?</h2>
          <div className="reset-feeling-grid">
            {REFLECTION_TAGS.map((tag) => (
              <button
                key={tag.value}
                type="button"
                className={selectedReflectionTag === tag.value ? "is-selected" : ""}
                onClick={() => onSelectReflectionTag(tag.value)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {isSaved ? (
        <p style={{ color: "var(--green-bright)", fontSize: 13 }}>
          Saved. Let the next action stay small.
        </p>
      ) : null}

      {saveError ? (
        <p className="reset-audio-error">{saveError}</p>
      ) : null}

      {selectedFeeling ? (
        <div className="reset-next-action">
          <p>Save the signal, then return to one useful action.</p>
          <button
            type="button"
            className="reset-primary-action"
            onClick={onSubmit}
            disabled={!canSubmit || isSaved}
          >
            {isSaved ? "Signal Saved" : isSaving ? "Saving..." : "Save Reset Signal"}
          </button>
          {isSaved ? (
            <button type="button" className="reset-quiet-action" onClick={onReturn}>
              Open The Loop
            </button>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="reset-quiet-action" onClick={onClose}>
        <RotateCcw size={15} aria-hidden="true" />
        Back to Reset Space
      </button>
    </div>
  );
}
