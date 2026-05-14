import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "../Icon";
import { getCinematicImage } from "../../utils/imageMapping";
import { supabase } from "../../lib/supabase";
import { useAppState } from "../../contexts/AppStateContext";

const CAT_COLORS = {
  focus: "#4DA8FF", discipline: "#FF9A4D",
  "emotional-reset": "#C084FC", reflection: "#7FD99A",
  health: "#FF6B6B", sleep: "#6B8AFF",
  meaning: "#FFD93D", awareness: "#4ECDC4",
  action: "#FF8C42", connection: "#FF69B4",
};

const FRAMEWORK_META = {
  ikigai:      { label: "Ikigai",      color: "#FFD93D", bg: "rgba(255,217,61,0.10)" },
  morita:      { label: "Morita",      color: "#4ECDC4", bg: "rgba(78,205,196,0.10)" },
  logotherapy: { label: "Logotherapy", color: "#C084FC", bg: "rgba(192,132,252,0.10)" },
  flow:        { label: "Flow",        color: "#4DA8FF", bg: "rgba(77,168,255,0.10)" },
  symbol:      { label: "Symbol",      color: "#FF8C42", bg: "rgba(255,140,66,0.10)" },
};

const DIFFICULTY_LABELS = {
  gentle: "Gentle", normal: "Steady", deeper: "Deeper",
};

const DIFFICULTY_COLORS = {
  gentle: "#7FD99A", normal: "#FFD93D", deeper: "#FF8C42",
};

const isLegacyDoneColumnError = (error) => {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("column") && message.includes("done");
};

function deriveAdaptiveHint(task) {
  const reason = String(task.personalization_reason || "").trim();
  if (
    reason.length >= 8
    && reason.length <= 120
    && !reason.includes("{{")
    && !reason.includes("user_id")
    && !reason.includes("_id")
    && !/\b(uuid|token|hash|sql|query|select|from|where)\b/i.test(reason)
  ) {
    return reason;
  }
  const { difficulty_level, category, smaller_version } = task;
  if (difficulty_level === "gentle") {
    return smaller_version
      ? "A gentle start — a smaller version is ready if needed."
      : "A gentle start — consistency matters more than intensity.";
  }
  if (difficulty_level === "deeper") return "A deeper step today — your recent pattern supports this.";
  if (category === "awareness") return "Noticing comes first. Awareness before action.";
  if (category === "meaning") return "Connecting effort to something that matters.";
  if (category === "action") return "Turning thought into one visible move.";
  return null;
}

export default function LoopTaskCard({
  task, onToggle, onSkip, onHover, dayProgress,
}) {
  const { updateTreeStats } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(Boolean(task.done ?? task.completed_at));
  const [showXpBurst, setShowXpBurst] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [useSmaller, setUseSmaller] = useState(false);

  const adaptiveHint = deriveAdaptiveHint(task);
  const displayTitle = useSmaller && task.smaller_version ? task.smaller_version : task.title;
  const displayPurpose = useSmaller && task.smaller_version
    ? `Smaller version: ${task.smaller_version}`
    : (task.detail_description || task.why || "");

  const handleComplete = async (id) => {
    if (isSubmitting || isDone) return;

    setIsSubmitting(true);
    setIsDone(true);

    if (onToggle) {
      try {
        await onToggle(id);
      } catch (err) {
        console.error("Interaction failed:", err);
        setIsDone(false);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    let responseData;

    try {
      const { data, error } = await supabase.rpc("complete_loop_task_v4", {
        p_task_id: id,
      });

      if (error) throw error;
      responseData = data;
    } catch (err) {
      if (!isLegacyDoneColumnError(err)) {
        console.error("Interaction failed:", err);
        setIsDone(false);
        setIsSubmitting(false);
        return;
      }

      const completedAt = new Date().toISOString();
      const { data: fallbackTask, error: updateError } = await supabase
        .from("loop_tasks")
        .update({ completed_at: completedAt })
        .eq("id", id)
        .is("completed_at", null)
        .select("*")
        .maybeSingle();

      if (updateError || !fallbackTask) {
        console.error("Interaction failed:", updateError ?? err);
        setIsDone(false);
        setIsSubmitting(false);
        return;
      }

      responseData = { task: fallbackTask };
    }

    updateTreeStats?.({
      vitality: responseData?.new_vitality,
      cumulative_score: responseData?.new_score,
      streak: responseData?.new_streak,
      tasksCompletedDelta: 1,
    });

    try {
      onToggle?.(id, responseData?.task);
    } catch (err) {
      console.error("Failed to sync parent loop state:", err);
    }

    setIsSubmitting(false);
  };

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, task, isDone]);

  useEffect(() => {
    const nextDoneState = Boolean(task.done ?? task.completed_at);
    setIsDone(nextDoneState);
    if (nextDoneState) setIsSubmitting(false);
  }, [task.completed_at, task.done]);

  const catColor = CAT_COLORS[task.category] || "var(--green-bright)";
  const categoryLabel = task.category
    ? task.category.charAt(0).toUpperCase() + task.category.slice(1)
    : "";
  const frameworkMeta = FRAMEWORK_META[task.framework_key] ?? null;
  const diffLabel = DIFFICULTY_LABELS[task.difficulty_level] || "";
  const diffColor = DIFFICULTY_COLORS[task.difficulty_level] || "var(--text-faint)";

  // purposeText is computed above as displayPurpose (adapts when useSmaller is active)

  // Micro-progress bar fraction (0–1)
  const progressFraction = dayProgress && dayProgress.total > 0
    ? Math.min(1, dayProgress.done / dayProgress.total)
    : null;

  const taskImage = getCinematicImage(task.category, task.title);
  const imageSeed = encodeURIComponent(
    String(task.id ?? `${task.category ?? "task"}-${task.title ?? "card"}`)
  );
  const taskImageSrc = taskImage.includes("?")
    ? `${taskImage}&category=${encodeURIComponent(task.category ?? "task")}&sig=${imageSeed}`
    : `${taskImage}?category=${encodeURIComponent(task.category ?? "task")}&sig=${imageSeed}`;

  return (
    <div
      className="loop-task-card"
      onMouseEnter={onHover}
      style={{
        background: "linear-gradient(135deg, rgba(13,22,17,0.96), rgba(8,15,12,0.98))",
        backdropFilter: "blur(24px)",
        border: `1px solid ${expanded ? "rgba(46,204,113,0.25)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 18,
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: expanded
          ? "0 0 0 1px rgba(46,204,113,0.15), 0 8px 32px rgba(0,0,0,0.4)"
          : "0 2px 12px rgba(0,0,0,0.25)",
        opacity: isDone ? 0.62 : 1,
        marginBottom: 12,
        position: "relative",
      }}
    >
      {/* Active indicator bar */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0, width: 3,
        background: catColor,
        opacity: expanded ? 1 : 0,
        transition: "opacity 0.3s ease",
        zIndex: 10,
      }} />

      {/* Dynamic header image (expanded only) */}
      {expanded && (
        <div style={{
          height: 110,
          width: "100%",
          overflow: "hidden",
          position: "relative",
          animation: "fadeIn 0.4s ease both",
        }}>
          <img
            src={taskImageSrc}
            alt={task.title}
            onError={(e) => { e.target.style.display = "none"; }}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(transparent 30%, rgba(8,15,12,0.85))",
          }} />
        </div>
      )}

      {/* Collapsed row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          cursor: "pointer",
        }}
      >
        {/* Checkbox + XP burst */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {showXpBurst && (
            <span style={{
              position: "absolute",
              top: -4, left: "50%",
              transform: "translateX(-50%)",
              animation: "xpFloat 0.85s ease-out forwards",
              fontSize: 11, fontWeight: 700,
              color: "rgba(126,217,154,1)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 20,
            }}>
              +10 pts
            </span>
          )}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (!isDone && !isSubmitting) {
              setShowXpBurst(true);
              setTimeout(() => setShowXpBurst(false), 900);
            }
            handleComplete(task.id);
          }}
          className="task-checkbox"
          style={{
            width: 24, height: 24, borderRadius: "50%",
            border: `2px solid ${isDone ? catColor : "rgba(255,255,255,0.18)"}`,
            background: isDone ? catColor : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            flexShrink: 0, cursor: "pointer",
            transform: isDone ? "scale(1.08)" : "scale(1)",
          }}
        >
          {isDone && <Icon name="check" size={11} color="white" strokeWidth={3} />}
        </div>
        </div>

        {/* Text area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{
              margin: 0, fontSize: 15, fontWeight: 500,
              color: isDone ? "var(--text-faint)" : "var(--text)",
              textDecoration: isDone ? "line-through" : "none",
            }}>
              {displayTitle}
            </p>
            {task.is_optional && (
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4,
                background: "rgba(255,255,255,0.05)",
                color: "var(--text-faint)", letterSpacing: 1,
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Optional
              </span>
            )}
            {frameworkMeta && !isDone && (
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 20,
                background: frameworkMeta.bg,
                color: frameworkMeta.color,
                fontWeight: 600, letterSpacing: 0.4,
                border: `1px solid ${frameworkMeta.color}33`,
                whiteSpace: "nowrap",
              }}>
                {frameworkMeta.label}
              </span>
            )}
          </div>
          {/* Category dot + time */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: catColor }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: catColor, flexShrink: 0 }} />
              {categoryLabel}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              ~{task.duration_minutes || 15} min
            </span>
          </div>
          {adaptiveHint && !isDone && (
            <p style={{
              margin: "4px 0 0",
              fontSize: 11,
              fontStyle: "italic",
              color: "var(--text-faint)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {adaptiveHint}
            </p>
          )}
        </div>

        {/* Difficulty pill */}
        {diffLabel && !isDone && (
          <span style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 6,
            background: `${diffColor}1A`,
            color: diffColor,
            letterSpacing: 0.5,
            fontWeight: 600, flexShrink: 0,
            border: `1px solid ${diffColor}28`,
          }}>
            {diffLabel}
          </span>
        )}

        {/* Caret */}
        <span style={{
          fontSize: 14, color: "var(--text-faint)",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.25s ease",
          display: "flex", alignItems: "center",
        }}>
          <Icon name="arrow" size={14} style={{ transform: "rotate(90deg)" }} />
        </span>
      </div>

      {/* Expanded content */}
      <div style={{
        maxHeight: expanded ? contentHeight + 240 : 0,
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div
          ref={contentRef}
          style={{
            padding: "0 20px 20px 58px",
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.3s ease 0.08s",
          }}
        >
          {/* Done when + Shorter version row */}
          {(task.success_condition || task.smaller_version) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: task.success_condition && task.smaller_version ? "1fr 1fr" : "1fr",
              gap: 12, marginBottom: 16,
            }}>
              {task.success_condition && (
                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: 1.2, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>
                    Done when
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    {task.success_condition}
                  </p>
                </div>
              )}
              {task.smaller_version && (
                <div style={{
                  background: useSmaller ? "rgba(46,204,113,0.07)" : "rgba(255,255,255,0.03)",
                  border: useSmaller ? "1px solid rgba(46,204,113,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "10px 12px",
                  transition: "all 0.2s ease",
                }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: 1.2, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>
                    {useSmaller ? "Using smaller version" : "Shorter version"}
                  </p>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    {task.smaller_version}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setUseSmaller(v => !v); }}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 6,
                      background: useSmaller ? "rgba(46,204,113,0.15)" : "rgba(255,255,255,0.06)",
                      border: useSmaller ? "1px solid rgba(46,204,113,0.3)" : "1px solid rgba(255,255,255,0.09)",
                      color: useSmaller ? "var(--green-bright)" : "var(--text-faint)",
                      cursor: "pointer", fontFamily: "var(--font-body)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {useSmaller ? "Back to full version" : "Use this instead"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Post-completion question preview */}
          {task.post_completion_question && !isDone && (
            <div style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: 1.2, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>
                After completing
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", fontStyle: "italic", lineHeight: 1.5 }}>
                {task.post_completion_question}
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {!isDone && (
              <button
                onClick={(e) => { e.stopPropagation(); handleComplete(task.id); }}
                disabled={isSubmitting}
                style={{
                  padding: "8px 16px", borderRadius: 9,
                  background: isSubmitting ? "rgba(46,204,113,0.05)" : "rgba(46,204,113,0.12)",
                  border: isSubmitting ? "1px solid rgba(46,204,113,0.08)" : "1px solid rgba(46,204,113,0.22)",
                  color: "var(--green-bright)",
                  fontSize: 12, cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)", fontWeight: 600,
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {isSubmitting ? "Completing..." : "Complete Task"}
              </button>
            )}
            {!isDone && !task.skipped && onSkip && (
              <button
                onClick={(e) => { e.stopPropagation(); onSkip(task.id); }}
                style={{
                  padding: "8px 12px", borderRadius: 9,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--text-faint)",
                  fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Skip today
              </button>
            )}
            <button
              id={`share-btn-${task.id}`}
              onClick={async (e) => {
                e.stopPropagation();
                const shareText = `Today's Focus: ${task.title} — via The Life Project`;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: "The Life Project", text: shareText, url: window.location.href });
                  } catch (err) {
                    if (err.name !== "AbortError") console.error(err);
                  }
                } else {
                  try {
                    await navigator.clipboard.writeText(shareText);
                    const btn = e.currentTarget;
                    const original = btn.textContent;
                    btn.textContent = "✓ Copied!";
                    btn.style.color = "var(--green-bright)";
                    setTimeout(() => { btn.textContent = original; btn.style.color = "var(--text-faint)"; }, 2000);
                  } catch {
                    window.prompt("Copy this:", shareText);
                  }
                }
              }}
              style={{
                padding: "8px 12px", borderRadius: 9,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "var(--text-faint)",
                fontSize: 12, cursor: "pointer",
                fontFamily: "var(--font-body)",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Icon name="arrow" size={10} style={{ transform: "rotate(-45deg)" }} />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Micro-progress bar (shown when dayProgress prop is provided) */}
      {progressFraction !== null && (
        <div style={{ height: 3, background: "rgba(255,255,255,0.04)" }}>
          <div style={{
            height: "100%",
            width: `${Math.round(progressFraction * 100)}%`,
            background: `linear-gradient(90deg, ${catColor}99, var(--green-bright))`,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            borderRadius: "0 2px 2px 0",
          }} />
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes xpFloat {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-28px); }
        }
        .task-checkbox:hover {
          box-shadow: 0 0 10px rgba(46,204,113,0.35);
        }
      `}</style>
    </div>
  );
}
