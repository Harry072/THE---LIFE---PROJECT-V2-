import { RotateCcw } from "lucide-react";

const MOOD_OPTIONS = [
  { value: "calmer",      label: "Calmer" },
  { value: "clearer",     label: "Clearer" },
  { value: "still_heavy", label: "Still heavy" },
  { value: "restless",    label: "Restless" },
  { value: "sleepy",      label: "Sleepy" },
  { value: "grateful",    label: "Grateful" },
];

const REFLECTION_TAGS = [
  { value: "noise",         label: "Noise" },
  { value: "pressure",      label: "Pressure" },
  { value: "overthinking",  label: "Overthinking" },
  { value: "scrolling",     label: "Scrolling" },
  { value: "loneliness",    label: "Loneliness" },
  { value: "nothing_clear", label: "Nothing clear yet" },
];

function getNextStepHint(mood) {
  switch (mood) {
    case "calmer":
    case "clearer":
      return "You have a moment of stillness. One small action can anchor it.";
    case "grateful":
      return "Hold this feeling privately for a moment, or let it become a gentle reflection.";
    case "still_heavy":
    case "restless":
      return "Heavy is okay. Stay here a little longer, or choose the tiniest possible step.";
    case "sleepy":
      return "Rest is a practice too. Return when you're ready — there is no rush.";
    default:
      return null;
  }
}

function getNextStepType(mood) {
  switch (mood) {
    case "calmer":
    case "clearer":
      return "loop";
    case "still_heavy":
    case "restless":
      return "reset";
    case "sleepy":
      return "rest";
    case "grateful":
      return "reflection";
    default:
      return "none";
  }
}

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
  onReflect,
  onClose,
}) {
  const canSubmit = Boolean(selectedFeeling && selectedReflectionTag && !isSaving);
  const nextStepHint = isSaved ? getNextStepHint(selectedFeeling) : null;
  const nextStepType = getNextStepType(selectedFeeling);

  return (
    <div className="reset-checkin">
      <div className="reset-checkin-ritual">
        <p className="reset-checkin-ritual-text">You returned for a moment.</p>
        <p className="reset-checkin-ritual-sub">One quiet signal before you move on.</p>
      </div>

      <h2>How does your mind feel now?</h2>
      <div className="reset-feeling-grid reset-feeling-grid--3col">
        {MOOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={selectedFeeling === option.value ? "is-selected" : ""}
            onClick={() => onSelectFeeling(option.value)}
            disabled={isSaved}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!isSaved ? (
        <>
          <h2 style={{ marginTop: 22 }}>What did your mind need less of?</h2>
          <div className="reset-feeling-grid reset-feeling-grid--3col">
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
          <p className="reset-checkin-microcopy">
            Honest is always right. No wrong answer here.
          </p>
        </>
      ) : null}

      {isSaved ? (
        <div className="reset-checkin-saved">
          <p className="reset-checkin-saved-label">Signal saved. The reset counts.</p>
          {nextStepHint ? (
            <p className="reset-checkin-next-step">{nextStepHint}</p>
          ) : null}
          <div className="reset-checkin-saved-actions">
            {nextStepType === "loop" ? (
              <button type="button" className="reset-primary-action" onClick={onReturn}>
                Open The Loop
              </button>
            ) : null}
            {nextStepType === "reset" ? (
              <>
                <button type="button" className="reset-primary-action" onClick={onClose}>
                  Stay in Reset Space
                </button>
                <button type="button" className="reset-quiet-action" onClick={onReturn}>
                  Open The Loop
                </button>
              </>
            ) : null}
            {nextStepType === "rest" ? (
              <button type="button" className="reset-primary-action" onClick={onClose}>
                Close gently
              </button>
            ) : null}
            {nextStepType === "reflection" ? (
              <>
                <button type="button" className="reset-primary-action" onClick={onReflect}>
                  Open Reflection
                </button>
                <button type="button" className="reset-quiet-action" onClick={onClose}>
                  Stay here
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {saveError ? (
        <p className="reset-audio-error" style={{ marginTop: "1rem" }}>
          {saveError || "Couldn’t save this signal, but the reset still counts."}
        </p>
      ) : null}

      {!isSaved ? (
        <div className="reset-next-action">
          <button
            type="button"
            className="reset-primary-action"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {isSaving ? "Saving…" : "Save Reset Signal"}
          </button>
        </div>
      ) : null}

      {!isSaved ? (
        <button type="button" className="reset-quiet-action reset-checkin-skip" onClick={onClose}>
          <RotateCcw size={14} aria-hidden="true" />
          Skip for now
        </button>
      ) : null}
    </div>
  );
}
