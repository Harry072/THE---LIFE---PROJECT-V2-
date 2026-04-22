import { useState } from "react";
 
export default function LoopDetailContent({ task, isMobile = false }) {
  const [showWhy, setShowWhy] = useState(false);
 
  if (!task) return null;
 
  return (
    <div style={{
      padding: isMobile ? "20px 0 10px" : 0,
      color: "white",
      animation: isMobile ? "fadeUp 0.3s ease both" : "none",
    }}>
      {/* Detail title */}
      <h3 style={{
        margin: "0 0 12px",
        fontSize: isMobile ? 20 : 26,
        fontWeight: 500,
        fontFamily: "var(--font-display)",
        lineHeight: 1.2,
      }}>
        {task.detail_title || task.title}
      </h3>
 
      {/* Description */}
      {task.detail_description && (
        <p style={{
          margin: "0 0 16px",
          fontSize: 14, lineHeight: 1.6,
          color: "rgba(255,255,255,0.72)",
          fontFamily: "var(--font-body)",
        }}>
          {task.detail_description}
        </p>
      )}
 
      {/* Meta */}
      <p style={{
        margin: "0 0 18px",
        fontSize: 12,
        color: "rgba(255,255,255,0.45)",
        fontFamily: "var(--font-body)",
      }}>
        {task.preferred_time}
        {" · "}
        {task.duration_minutes || task.estimated_duration_mins} Minutes
      </p>
 
      {/* Why this helps button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowWhy(!showWhy);
        }}
        style={{
          padding: "8px 20px",
          background: showWhy
            ? "rgba(255,255,255,0.15)"
            : "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 12,
          color: "white",
          fontSize: 13,
          fontFamily: "var(--font-body)",
          cursor: "pointer",
          transition: "all 0.3s",
        }}
      >
        {showWhy ? "Close" : "Why this helps"}
      </button>
 
      {/* Why panel */}
      {showWhy && task.why && (
        <div style={{
          marginTop: 16,
          padding: "16px 18px",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          animation: "fadeUp 0.3s ease both",
        }}>
          <p style={{
            margin: 0,
            fontSize: 14, lineHeight: 1.7,
            color: "rgba(255,255,255,0.8)",
            fontFamily: "var(--font-body)",
          }}>
            {task.why}
          </p>
        </div>
      )}
    </div>
  );
}
