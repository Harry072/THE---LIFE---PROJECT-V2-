import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";

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
  task, onToggle, onSkip, onReplace,
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, task]);

  const catColor = CAT_COLORS[task.category] || "var(--green-bright)";
  const intensity = INTENSITY[task.intensity] || INTENSITY.medium;

  return (
    <div
      className="loop-task-card"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${expanded ? "var(--border-strong)" : "rgba(255, 255, 255, 0.08)"}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: expanded ? "0 0 16px rgba(46, 204, 113, 0.1)" : "none",
        opacity: task.done ? 0.6 : 1,
        marginBottom: 12,
      }}
    >
      {/* Collapsed row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          cursor: "pointer",
        }}
      >
        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          style={{
            width: 24, height: 24, borderRadius: "50%",
            border: `2px solid ${task.done ? "var(--green-bright)" : "rgba(255, 255, 255, 0.2)"}`,
            background: task.done ? "var(--green-bright)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s", flexShrink: 0, cursor: "pointer",
          }}
        >
          {task.done && <Icon name="check" size={12} color="white" strokeWidth={3} />}
        </div>

        {/* Text */}
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

        {/* Category pill */}
        <span style={{
          fontSize: 10, padding: "3px 8px", borderRadius: 6,
          background: `${catColor}15`,
          color: catColor,
          fontWeight: 600, letterSpacing: 0.8,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          {task.category}
        </span>

        {/* Time */}
        <span style={{
          fontSize: 12, color: "var(--text-faint)",
          whiteSpace: "nowrap",
          display: "none", // Hide on small screens if needed, but keeping for spec
        }}>
          {task.preferred_time}
        </span>

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
        maxHeight: expanded ? contentHeight : 0,
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
          {/* Why this helps */}
          {task.why && (
            <div style={{
              borderLeft: `3px solid ${catColor}`,
              paddingLeft: 16, marginBottom: 16,
            }}>
              <p style={{
                margin: 0, fontSize: 15,
                fontFamily: "var(--font-display)",
                fontStyle: "italic", fontWeight: 400,
                color: "var(--text-dim)", lineHeight: 1.6,
              }}>
                {task.why}
              </p>
            </div>
          )}

          {/* Meta row */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: 16, marginBottom: 16, flexWrap: "wrap",
          }}>
            <span style={{
              fontSize: 12, color: "var(--text-dim)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Icon name="meditate" size={14} /> ~{task.duration_minutes} min
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
                onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  background: "rgba(46,204,113,0.1)",
                  border: "1px solid rgba(46,204,113,0.2)",
                  color: "var(--green-bright)",
                  fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Mark Done
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
                Too hard — make easier
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
