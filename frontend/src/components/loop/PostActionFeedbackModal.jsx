import { useState } from "react";

const MOOD_OPTIONS = [
  { value: "clear",    label: "Clear" },
  { value: "focused",  label: "Focused" },
  { value: "proud",    label: "Proud" },
  { value: "restless", label: "Restless" },
  { value: "heavy",    label: "Heavy" },
  { value: "neutral",  label: "Neutral" },
];

const FRICTION_OPTIONS = [
  { value: "too_easy",    label: "Too easy" },
  { value: "right_sized", label: "Right-sized" },
  { value: "too_heavy",   label: "Too heavy" },
];

const SKIP_REASON_OPTIONS = [
  { value: "too_heavy",    label: "Too heavy" },
  { value: "no_time",      label: "Not enough time" },
  { value: "not_relevant", label: "Didn't feel right" },
  { value: "forgot",       label: "Forgot" },
];

export default function PostActionFeedbackModal({
  task,
  isSkip = false,
  isSaving = false,
  error = "",
  awardedPoints = 0,
  newStreak = 0,
  onSubmit,
  onClose,
}) {
  const [moodAfter, setMoodAfter] = useState("");
  const [frictionLevel, setFrictionLevel] = useState("");
  const [skipReason, setSkipReason] = useState("");

  const canSubmit = isSkip
    ? Boolean(moodAfter && skipReason && !isSaving)
    : Boolean(moodAfter && frictionLevel && !isSaving);

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isSkip) {
      onSubmit?.({
        completion_state: "skipped",
        skip_reason_label: skipReason,
        mood_after: moodAfter,
        post_action_mood: moodAfter,
      });
    } else {
      onSubmit?.({
        completion_state: "done",
        mood_after: moodAfter,
        post_action_mood: moodAfter,
        task_friction_level: frictionLevel,
      });
    }
  };

  const title = isSkip ? "Before you move on" : "How did that land?";
  const subtitle = isSkip
    ? "No pressure — one signal helps tomorrow feel lighter."
    : "One honest signal helps tomorrow's step fit better.";

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
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close feedback"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(4, 8, 6, 0.80)",
          backdropFilter: "blur(16px)",
          cursor: "default",
        }}
      />

      <section
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          borderRadius: 20,
          border: "1px solid rgba(126, 217, 154, 0.18)",
          background: "linear-gradient(180deg, rgba(13, 25, 18, 0.99), rgba(8, 15, 12, 0.99))",
          boxShadow: "0 32px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(46,204,113,0.08)",
          padding: 28,
          color: "var(--text, #fff)",
          animation: "fadeSlideUp 0.25s ease both",
        }}
      >
        <p style={{
          margin: 0,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          After-action check
        </p>
        <h2
          id="post-action-feedback-title"
          style={{
            margin: "8px 0 6px",
            fontSize: 22,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
          }}
        >
          {title}
        </h2>
        <p style={{
          margin: 0,
          color: "var(--text-dim)",
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>

        {/* Skip reason (only for skip flow) */}
        {isSkip && (
          <div style={{ marginTop: 22 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-dim)" }}>
              What made it hard to start?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {SKIP_REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSkipReason(opt.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: skipReason === opt.value
                      ? "1px solid rgba(126, 217, 154, 0.65)"
                      : "1px solid rgba(255,255,255,0.07)",
                    background: skipReason === opt.value
                      ? "rgba(46, 204, 113, 0.13)"
                      : "rgba(255,255,255,0.03)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mood question */}
        <div style={{ marginTop: 20 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-dim)" }}>
            How does your mind feel now?
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-faint)" }}>
            {isSkip ? "Your honest answer shapes tomorrow's step." : "This shapes how tomorrow's task is sized."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMoodAfter(opt.value)}
                style={{
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: moodAfter === opt.value
                    ? "1px solid rgba(126, 217, 154, 0.65)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: moodAfter === opt.value
                    ? "rgba(46, 204, 113, 0.13)"
                    : "rgba(255,255,255,0.03)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  transition: "all 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Friction question (only for completion flow) */}
        {!isSkip && (
          <div style={{ marginTop: 18 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-dim)" }}>
              Was this task the right size?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {FRICTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrictionLevel(opt.value)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    border: frictionLevel === opt.value
                      ? "1px solid rgba(126, 217, 154, 0.65)"
                      : "1px solid rgba(255,255,255,0.07)",
                    background: frictionLevel === opt.value
                      ? "rgba(46, 204, 113, 0.13)"
                      : "rgba(255,255,255,0.03)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <p style={{ margin: "14px 0 0", color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>
            Couldn&rsquo;t save this time — that&rsquo;s okay. Your momentum still counts.
          </p>
        ) : null}

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 24,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: 13,
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid rgba(126, 217, 154, 0.32)",
              background: canSubmit ? "var(--green-bright)" : "rgba(126, 217, 154, 0.14)",
              color: canSubmit ? "#06100b" : "rgba(255,255,255,0.45)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              transition: "all 0.2s ease",
            }}
          >
            {isSaving ? "Saving..." : "Save signal"}
          </button>
        </div>

        {!isSkip && awardedPoints > 0 && (
          <p style={{
            fontSize: 12,
            color: "var(--text-faint)",
            textAlign: "center",
            marginTop: 12,
            marginBottom: 0,
            fontFamily: "var(--font-body)",
          }}>
            ✓ +{awardedPoints} pts awarded · Streak: {newStreak} days
          </p>
        )}
      </section>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
