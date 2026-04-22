import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";
import { getCinematicImage } from "../../utils/imageMapping";

const CAT_COLORS = {
  focus: "#4DA8FF", discipline: "#FF9A4D",
  "emotional-reset": "#C084FC", reflection: "#7FD99A",
  health: "#FF6B6B", sleep: "#6B8AFF",
  meaning: "#FFD93D", awareness: "#4ECDC4",
  action: "#FF8C42", connection: "#FF69B4",
};

const INTENSITY = {
  light: { color: "#7FD99A", label: "Light" },
  medium: { color: "#FFD93D", label: "Medium" },
  deep: { color: "#FF8C42", label: "Deep" },
};

export default function LoopTaskCard({
  task, onToggle, onSkip, onReplace, onHover,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  const handleToggle = async (id) => {
    if (isSubmitting || task.done) return;
    setIsSubmitting(true);
    try {
      await onToggle(id);
      // We don't necessarily reset isSubmitting if the component unmounts or re-renders
      // but the optimistic update will handle the visual swap to 'done' anyway.
    } catch (err) {
      console.error("Interaction failed:", err);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(expanded ? height : 0);
    }
  }, [expanded, showWhy, task]);

  const catColor = CAT_COLORS[task.category] || "var(--green-bright)";
  const intensity = INTENSITY[task.intensity] || INTENSITY.medium;

  // Cinematic image based on category and title
  const taskImage = getCinematicImage(task.category, task.title);

  return (
    <div
      className="loop-task-card"
      onMouseEnter={onHover}
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${expanded ? "var(--border-strong)" : "rgba(255, 255, 255, 0.08)"}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: expanded ? "0 0 24px rgba(46, 204, 113, 0.15)" : "none",
        opacity: task.done ? 0.6 : 1,
        marginBottom: 12,
        position: "relative",
      }}
    >
      {/* Active indicator bar */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0, width: 4,
        background: "var(--green-bright)",
        opacity: expanded ? 1 : 0,
        transition: "opacity 0.3s ease",
        zIndex: 10,
      }} />
      
      {/* Dynamic Header Image (Visible only when expanded) */}
      {expanded && (
        <div style={{
          height: 120,
          width: "100%",
          overflow: "hidden",
          position: "relative",
          animation: "fadeIn 0.5s ease both",
        }}>
          <img 
            src={taskImage} 
            alt={task.title}
            onError={(e) => { e.target.style.display = 'none'; }}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
          }} />
        </div>
      )}

      {/* Collapsed row (The Trigger) */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          cursor: "pointer",
        }}
      >
        {/* Checkbox (Complete Action) */}
        <div
          onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }}
          className="task-checkbox"
          style={{
            width: 24, height: 24, borderRadius: "50%",
            border: `2px solid ${task.done ? "var(--green-bright)" : "rgba(255, 255, 255, 0.2)"}`,
            background: task.done ? "var(--green-bright)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)", 
            flexShrink: 0, cursor: "pointer",
            transform: task.done ? "scale(1.1)" : "scale(1)",
          }}
        >
          {task.done && <Icon name="check" size={12} color="white" strokeWidth={3} />}
        </div>

        {/* Text Area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{
              margin: 0, fontSize: 15, fontWeight: 500,
              color: task.done ? "var(--text-faint)" : "var(--text)",
              textDecoration: task.done ? "line-through" : "none",
            }}>
              {task.title}
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
          </div>
          <p style={{
            margin: "2px 0 0", fontSize: 12,
            color: "var(--text-faint)",
          }}>
            {task.subtitle}
          </p>
        </div>

        {/* Why Button (Small explicit link) */}
        {!expanded && !task.done && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setShowWhy(true); }}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 10,
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            WHY?
          </button>
        )}

        {/* Caret */}
        <span style={{
          fontSize: 14, color: "var(--text-faint)",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.25s ease",
          display: "flex", alignItems: "center"
        }}>
           <Icon name="arrow" size={14} style={{ transform: "rotate(90deg)" }} />
        </span>
      </div>

      {/* Expanded content */}
      <div style={{
        maxHeight: expanded ? contentHeight + 200 : 0, // Adding buffer
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div
          ref={contentRef}
          style={{
            padding: "0 20px 20px 58px", // align with text above
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.3s ease 0.1s",
          }}
        >
          {/* Why this helps section */}
          <div style={{ marginBottom: 16 }}>
             <button
                onClick={(e) => { e.stopPropagation(); setShowWhy(!showWhy); }}
                style={{
                   background: "none", border: "none", padding: 0,
                   color: catColor, fontWeight: 600, fontSize: 12,
                   cursor: "pointer", marginBottom: 8,
                   display: "flex", alignItems: "center", gap: 6
                }}
             >
                <Icon name="meditate" size={12} />
                {showWhy ? "Hide Purpose ↑" : "Why this helps? ↓"}
             </button>

             {showWhy && (
                <div style={{
                  borderLeft: `3px solid ${catColor}`,
                  paddingLeft: 16, marginTop: 8,
                  animation: "fadeIn 0.3s ease both",
                }}>
                  <p style={{
                    margin: 0, fontSize: 15,
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic", fontWeight: 400,
                    color: "var(--text-dim)", lineHeight: 1.6,
                  }}>
                    {task.why || "This small win builds the foundation for your larger journey."}
                  </p>
                </div>
             )}
          </div>

          {/* Meta row */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: 16, marginBottom: 16, flexWrap: "wrap",
          }}>
            <span style={{
              fontSize: 12, color: "var(--text-dim)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Icon name="meditate" size={14} /> ~{task.duration_minutes || 15} min
            </span>
            <span style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 12, color: intensity.color,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: intensity.color,
              }} />
              {intensity.label} Intensity
            </span>
          </div>

          {/* Actions */}
          <div style={{
            display: "flex", gap: 12, alignItems: "center",
          }}>
            {!task.done && (
              <button
                onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }}
                disabled={isSubmitting}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  background: isSubmitting ? "rgba(46,204,113,0.05)" : "rgba(46,204,113,0.1)",
                  border: isSubmitting ? "1px solid rgba(46,204,113,0.1)" : "1px solid rgba(46,204,113,0.2)",
                  color: "var(--green-bright)",
                  fontSize: 12, cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Completing..." : "Complete Task"}
              </button>
            )}
            {!task.done && !task.skipped && (
              <button
                onClick={(e) => { e.stopPropagation(); onReplace(task.id); }}
                style={{
                  padding: "8px 12px", borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.05)",
                  color: "var(--text-faint)",
                  fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Make Easier
              </button>
            )}
            <button
              id={`share-btn-${task.id}`}
              onClick={async (e) => {
                e.stopPropagation();
                const shareText = `Today's Focus: ${task.title} — via The Life Project`;
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: "The Life Project",
                      text: shareText,
                      url: window.location.href,
                    });
                  } catch (err) {
                    if (err.name !== 'AbortError') console.error(err);
                  }
                } else {
                  try {
                    await navigator.clipboard.writeText(shareText);
                    const btn = e.currentTarget;
                    const original = btn.textContent;
                    btn.textContent = '✓ Copied!';
                    btn.style.color = 'var(--green-bright)';
                    setTimeout(() => { btn.textContent = original; btn.style.color = 'var(--text-faint)'; }, 2000);
                  } catch {
                    window.prompt('Copy this:', shareText);
                  }
                }
              }}
              style={{
                padding: "8px 12px", borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.05)",
                color: "var(--text-faint)",
                fontSize: 12, cursor: "pointer",
                fontFamily: "var(--font-body)",
                display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Icon name="arrow" size={10} style={{ transform: "rotate(-45deg)" }} />
              Share
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .task-checkbox:hover {
            box-shadow: 0 0 12px var(--green-bright);
        }
      `}</style>
    </div>
  );
}
