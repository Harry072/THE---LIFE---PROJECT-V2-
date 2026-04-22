import { useState } from "react";
import Icon from "../Icon";

export default function LoopTaskRow({ task, isActive, onHover, onToggle }) {
  const [showExtras, setShowExtras] = useState(false);

  // Delay showing extras for smooth feel
  const handleEnter = () => {
    onHover();
    setTimeout(() => setShowExtras(true), 150);
  };
  const handleLeave = () => {
    setShowExtras(false);
  };

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onHover}
      style={{
        position: "relative",
        padding: "16px 24px",
        borderBottom: "1px solid var(--border)",
        background: isActive ? "rgba(46,204,113,0.06)" : "transparent",
        cursor: "pointer",
        transition: "background 0.3s ease",
        height: isActive && showExtras && !task.done ? "auto" : "auto", // Allowing expansion
        minHeight: 75,
      }}
    >
      {/* Active indicator bar */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0, width: 3,
        background: "var(--green-bright)",
        opacity: isActive ? 1 : 0,
        transition: "opacity 0.25s ease",
        borderRadius: "0 2px 2px 0",
      }} />

      {/* Main row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}>
        {/* Checkbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            width: 24, height: 24,
            borderRadius: "50%", flexShrink: 0,
            border: `2px solid ${task.done ? "var(--green-bright)" : "var(--border-strong)"}`,
            background: task.done ? "var(--green-bright)" : "transparent",
            display: "flex", alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            transform: task.done ? "scale(1)" : "scale(1)",
          }}
        >
          {task.done && (
            <Icon name="check" size={12} color="white" strokeWidth={3} />
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 16, fontWeight: 500,
            color: task.done ? "var(--text-dim)" : "var(--text)",
            textDecoration: task.done ? "line-through" : "none",
            transition: "all 0.3s",
            fontFamily: "var(--font-body)",
          }}>
            {task.title}
          </p>
          <p style={{
            margin: "2px 0 0", fontSize: 13,
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
          }}>
            {task.subtitle}
          </p>
        </div>

        {/* Time - hidden on very small screens, though handled mostly by parent grid */}
        <span style={{
          fontSize: 13, color: "var(--text-faint)",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-body)",
        }}>
          {task.preferred_time}
        </span>
      </div>

      {/* Expanded inline extras (on hover) */}
      {isActive && showExtras && !task.done && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 10,
          paddingLeft: 38,
          animation: "fadeUp 0.2s ease both",
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              padding: "6px 16px",
              background: "rgba(46,204,113,0.1)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              color: "var(--green-bright)",
              fontSize: 12,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={e=> e.currentTarget.style.background = "rgba(46,204,113,0.15)"}
            onMouseOut={e=> e.currentTarget.style.background = "rgba(46,204,113,0.1)"}
          >
            Mark as Done
          </button>
          <span style={{
            fontSize: 11, padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-dim)",
            textTransform: "capitalize",
            fontFamily: "var(--font-body)",
          }}>
            {task.category}
          </span>
        </div>
      )}

      {/* Inline quote (if present) */}
      {isActive && task.inline_quote && (
        <p style={{
          margin: "10px 0 0 38px",
          fontSize: 13, fontStyle: "italic",
          color: "var(--text-dim)",
          fontFamily: "var(--font-display)",
          animation: "fadeIn 0.4s ease both",
          animationDelay: "0.2s",
        }}>
          {task.inline_quote}
        </p>
      )}
      
      <style>{`
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
