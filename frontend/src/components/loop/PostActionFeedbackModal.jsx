import { useState } from "react";

const MOOD_OPTIONS = [
  { value: "clear", label: "Clear" },
  { value: "focused", label: "Focused" },
  { value: "restless", label: "Restless" },
  { value: "heavy", label: "Heavy" },
];

const FRICTION_OPTIONS = [
  { value: "too_easy", label: "Too easy" },
  { value: "right_sized", label: "Right-sized" },
  { value: "too_heavy", label: "Too heavy" },
];

export default function PostActionFeedbackModal({
  task,
  isSaving = false,
  error = "",
  onSubmit,
  onClose,
}) {
  const [moodAfter, setMoodAfter] = useState("");
  const [frictionLevel, setFrictionLevel] = useState("");

  const canSubmit = Boolean(moodAfter && frictionLevel && !isSaving);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit?.({
      completion_state: "done",
      mood_after: moodAfter,
      post_action_mood: moodAfter,
      task_friction_level: frictionLevel,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-action-feedback-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <button
        type="button"
        aria-label="Close feedback"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(4, 8, 6, 0.72)",
          backdropFilter: "blur(14px)",
          cursor: "default",
        }}
      />
      <section
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(126, 217, 154, 0.2)",
          background: "linear-gradient(180deg, rgba(13, 25, 18, 0.98), rgba(8, 15, 12, 0.98))",
          boxShadow: "0 28px 80px rgba(0, 0, 0, 0.5)",
          padding: 24,
          color: "var(--text, #fff)",
        }}
      >
        <p style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          After-action check
        </p>
        <h2
          id="post-action-feedback-title"
          style={{
            margin: "8px 0 8px",
            fontSize: 24,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
          }}
        >
          How did that land?
        </h2>
        <p style={{
          margin: 0,
          color: "var(--text-dim)",
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          {task?.title ? `For "${task.title}", save one small signal.` : "Save one small signal for tomorrow."}
        </p>

        <div style={{ marginTop: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-dim)" }}>
            How does your mind feel now?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMoodAfter(option.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: moodAfter === option.value
                    ? "1px solid rgba(126, 217, 154, 0.72)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: moodAfter === option.value
                    ? "rgba(46, 204, 113, 0.14)"
                    : "rgba(255,255,255,0.035)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-dim)" }}>
            Was the task the right size?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {FRICTION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFrictionLevel(option.value)}
                style={{
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: frictionLevel === option.value
                    ? "1px solid rgba(126, 217, 154, 0.72)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: frictionLevel === option.value
                    ? "rgba(46, 204, 113, 0.14)"
                    : "rgba(255,255,255,0.035)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p style={{ margin: "14px 0 0", color: "#f87171", fontSize: 13 }}>
            {error}
          </p>
        ) : null}

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 22,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(126, 217, 154, 0.35)",
              background: canSubmit ? "var(--green-bright)" : "rgba(126, 217, 154, 0.16)",
              color: canSubmit ? "#06100b" : "rgba(255,255,255,0.52)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontFamily: "var(--font-body)",
            }}
          >
            {isSaving ? "Saving..." : "Save signal"}
          </button>
        </div>
      </section>
    </div>
  );
}

