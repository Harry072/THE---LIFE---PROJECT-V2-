import { useState, useEffect } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { supabase } from "../../lib/supabase";

const CAT_COLORS = {
  focus: "#4DA8FF", discipline: "#FF9A4D",
  "emotional-reset": "#C084FC", reflection: "#7FD99A",
  health: "#FF6B6B", sleep: "#6B8AFF",
  meaning: "#FFD93D", awareness: "#4ECDC4",
  action: "#FF8C42", connection: "#FF69B4",
};

const WHY_CHOSEN_FALLBACKS = {
  awareness: "This practice helps you notice the inner loop before it controls the day.",
  action: "This practice turns mental noise into one useful movement.",
  meaning: "This practice connects the day to something larger than distraction.",
};

const getWhyChosen = (task) => {
  const explicit = String(task?.why_chosen || "").trim();
  if (explicit) return explicit;
  const cat = String(task?.category || "").toLowerCase();
  return WHY_CHOSEN_FALLBACKS[cat] || "Based on your current growth path, this practice helps turn awareness into action.";
};

const isLegacyDoneColumnError = (err) => {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return msg.includes("column") && msg.includes("done");
};

export default function LoopDetailContent({ task, onToggle, onSkip, isMobile = false }) {
  const { updateTreeStats, user_tree } = useAppState();
  const [infoOpen, setInfoOpen] = useState(false);
  const [useSmaller, setUseSmaller] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(Boolean(task?.done ?? task?.completed_at));

  useEffect(() => {
    setIsDone(Boolean(task?.done ?? task?.completed_at));
  }, [task?.done, task?.completed_at]);

  if (!task) return null;

  const vitality = Math.min(100, Math.max(0, user_tree?.vitality ?? 50));
  const vitalityColor = vitality >= 50 ? "#7ED99A" : vitality >= 20 ? "#F0A500" : "#555";

  const catColor = CAT_COLORS[task.category] || "var(--green-bright)";
  const categoryLabel = task.category
    ? task.category.charAt(0).toUpperCase() + task.category.slice(1)
    : "";
  const duration = task.duration_minutes || task.estimated_duration_mins;
  const displayTitle = useSmaller && task.smaller_version
    ? task.smaller_version
    : (task.detail_title || task.title);
  const whyChosen = getWhyChosen(task);
  const detailDescription = String(task.detail_description || "").trim();
  const inlineQuote = String(task.inline_quote || "").trim();

  const handleComplete = async () => {
    if (isSubmitting || isDone) return;
    setIsSubmitting(true);
    setIsDone(true);

    if (onToggle) {
      try {
        await onToggle(task.id);
      } catch {
        setIsDone(false);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.rpc("complete_loop_task_v4", { p_task_id: task.id });
      if (error) throw error;
      updateTreeStats?.({
        vitality: data?.new_vitality,
        cumulative_score: data?.new_score,
        streak: data?.new_streak,
        tasksCompletedDelta: 1,
      });
    } catch (err) {
      if (!isLegacyDoneColumnError(err)) setIsDone(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: isMobile ? "relative" : "absolute",
        inset: isMobile ? "auto" : "auto 0 0 0",
        color: "white",
      }}
    >
      {/* gradient overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.76) 52%, rgba(0,0,0,0.24) 82%, rgba(0,0,0,0) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: isMobile ? "18px 18px 24px" : "80px 28px 32px",
          overflowY: "auto",
          maxHeight: isMobile ? "52vh" : "60vh",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(107,114,128,0.8) transparent",
        }}
      >
        {/* Category badge + duration */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {categoryLabel && (
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 0.8,
              color: catColor, fontFamily: "var(--font-body)",
              background: `${catColor}1A`, padding: "3px 9px", borderRadius: 6,
            }}>
              {categoryLabel}
            </span>
          )}
          {duration && (
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.38)",
              fontFamily: "var(--font-body)",
            }}>
              {duration} min
            </span>
          )}
          {isDone && (
            <span style={{
              marginLeft: "auto", fontSize: 11, fontWeight: 600,
              color: "var(--green-bright)", background: "rgba(126,217,154,0.12)",
              padding: "3px 10px", borderRadius: 6,
            }}>
              ✓ Done
            </span>
          )}
        </div>

        {/* Task title */}
        <h2 style={{
          margin: "0 0 16px",
          fontSize: isMobile ? 20 : 26,
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          lineHeight: 1.18,
          letterSpacing: "0.01em",
          color: "white",
          maxWidth: "95%",
        }}>
          {displayTitle}
        </h2>

        {/* Success condition */}
        {task.success_condition && (
          <div style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.07)",
          }}>
            <p style={{
              margin: "0 0 3px", fontSize: 10, letterSpacing: 1.2,
              color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600,
            }}>
              Done when
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.52 }}>
              {task.success_condition}
            </p>
          </div>
        )}

        {/* Smaller version toggle */}
        {task.smaller_version && (
          <div style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            background: useSmaller ? "rgba(46,204,113,0.07)" : "rgba(255,255,255,0.03)",
            boxShadow: useSmaller
              ? "0 0 0 1px rgba(46,204,113,0.22)"
              : "0 0 0 1px rgba(255,255,255,0.06)",
            transition: "background 0.2s ease, box-shadow 0.2s ease",
          }}>
            <p style={{
              margin: "0 0 4px", fontSize: 10, letterSpacing: 1.2,
              color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600,
            }}>
              {useSmaller ? "Using shorter version" : "Shorter version available"}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              {task.smaller_version}
            </p>
            <button
              type="button"
              onClick={() => setUseSmaller((v) => !v)}
              style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                background: useSmaller ? "rgba(46,204,113,0.15)" : "rgba(255,255,255,0.06)",
                boxShadow: useSmaller
                  ? "0 0 0 1px rgba(46,204,113,0.28)"
                  : "0 0 0 1px rgba(255,255,255,0.09)",
                border: "none",
                color: useSmaller ? "var(--green-bright)" : "var(--text-faint)",
                cursor: "pointer", fontFamily: "var(--font-body)",
                transition: "all 0.2s ease",
              }}
            >
              {useSmaller ? "Back to full version" : "Use this instead"}
            </button>
          </div>
        )}

        {/* Complete button — DOMINANT */}
        <button
          type="button"
          onClick={handleComplete}
          disabled={isDone || isSubmitting}
          style={{
            width: "100%",
            minHeight: 50,
            padding: "14px 20px",
            borderRadius: 14,
            background: isDone
              ? "rgba(46,204,113,0.12)"
              : isSubmitting
                ? "rgba(46,204,113,0.35)"
                : "var(--green-bright)",
            border: "none",
            color: isDone ? "var(--green-bright)" : "#06100b",
            fontSize: 15,
            fontWeight: 700,
            cursor: isDone || isSubmitting ? "not-allowed" : "pointer",
            fontFamily: "var(--font-body)",
            letterSpacing: 0.3,
            opacity: isDone ? 0.72 : 1,
            transition: "background 0.25s ease, opacity 0.2s ease",
            boxShadow: isDone ? "none" : "0 4px 22px rgba(46,204,113,0.28)",
            marginBottom: 8,
          }}
        >
          {isDone ? "✓ Completed" : isSubmitting ? "Completing…" : "Complete Task"}
        </button>

        {/* Skip link */}
        {!isDone && onSkip && (
          <button
            type="button"
            onClick={() => onSkip(task.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              padding: "4px 0 14px",
              letterSpacing: 0.2,
            }}
          >
            Skip today
          </button>
        )}

        {/* Vitality micro-bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: `${!isDone && onSkip ? 0 : 14}px 0 20px`,
        }}>
          <span style={{ fontSize: 14 }}>🌱</span>
          <div style={{
            flex: 1, height: 4,
            background: "rgba(255,255,255,0.08)", borderRadius: 2,
          }}>
            <div style={{
              width: `${vitality}%`, height: "100%",
              background: vitalityColor, borderRadius: 2,
              transition: "width 0.5s ease",
            }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>
            {vitality} vitality
          </span>
        </div>

        {/* Info drawer trigger */}
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: infoOpen ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            padding: "4px 0",
            letterSpacing: 0.3,
            transition: "color 0.18s ease",
          }}
        >
          <span style={{
            width: 16, height: 16, borderRadius: "50%",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10,
          }}>
            ⓘ
          </span>
          {infoOpen ? "Hide details" : "Why this task"}
        </button>

        {/* Info drawer — spring animated */}
        <div
          aria-hidden={!infoOpen}
          style={{
            maxHeight: infoOpen ? 520 : 0,
            overflow: "hidden",
            opacity: infoOpen ? 1 : 0,
            transition: [
              "max-height 0.36s cubic-bezier(0.175,0.885,0.32,1.275)",
              "opacity 0.24s ease",
            ].join(", "),
          }}
        >
          <div style={{ paddingTop: 14 }}>
            {detailDescription && (
              <p style={{
                margin: "0 0 14px",
                fontSize: 14,
                lineHeight: 1.74,
                color: "rgba(255,255,255,0.68)",
                fontFamily: "var(--font-body)",
              }}>
                {detailDescription}
              </p>
            )}
            {whyChosen && (
              <div style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(46,204,113,0.055)",
                boxShadow: "0 0 0 1px rgba(126,217,154,0.13)",
                marginBottom: 12,
              }}>
                <p style={{
                  margin: "0 0 4px", fontSize: 10, letterSpacing: 1.2,
                  color: "rgba(126,217,154,0.78)", textTransform: "uppercase", fontWeight: 600,
                }}>
                  Why this was chosen
                </p>
                <p style={{
                  margin: 0, fontSize: 13, lineHeight: 1.62,
                  color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-body)",
                }}>
                  {whyChosen}
                </p>
              </div>
            )}
            {inlineQuote && (
              <p style={{
                margin: "0 0 8px",
                fontSize: 13,
                lineHeight: 1.72,
                color: "rgba(255,255,255,0.38)",
                fontStyle: "italic",
                fontFamily: "var(--font-display)",
              }}>
                &ldquo;{inlineQuote}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
