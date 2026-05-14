import { useState } from "react";

const TAGS = [
  {
    key: "deep_work",
    label: "Deep Work",
    description: "High-focus, demanding",
    icon: "⚡",
    color: "#4DA8FF",
    bg: "rgba(77,168,255,0.07)",
    activeBg: "rgba(77,168,255,0.14)",
    glow: "rgba(77,168,255,0.22)",
  },
  {
    key: "mental_reset",
    label: "Mental Reset",
    description: "Gentle, restorative",
    icon: "🌿",
    color: "#7FD99A",
    bg: "rgba(127,217,154,0.07)",
    activeBg: "rgba(127,217,154,0.14)",
    glow: "rgba(127,217,154,0.22)",
  },
  {
    key: "physical_action",
    label: "Physical Action",
    description: "Body-first, movement",
    icon: "🏃",
    color: "#FF8C42",
    bg: "rgba(255,140,66,0.07)",
    activeBg: "rgba(255,140,66,0.14)",
    glow: "rgba(255,140,66,0.22)",
  },
];

export default function RecalibrateBar({ generating, onSelect, onRegenerate }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);

  function handleOpen() {
    if (!generating) setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleTagSelect(key) {
    setOpen(false);
    onSelect?.(key);
  }

  function handleJustRegenerate() {
    setOpen(false);
    onRegenerate?.();
  }

  return (
    <div
      style={{
        marginBottom: 20,
        borderRadius: 18,
        background: open
          ? "linear-gradient(180deg, rgba(18,28,22,0.9) 0%, rgba(12,20,16,0.95) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.012) 100%)",
        boxShadow: open
          ? "0 12px 40px rgba(0,0,0,0.38), 0 0 0 1px rgba(126,217,154,0.12)"
          : "0 4px 18px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.055)",
        transition: "box-shadow 0.3s ease, background 0.3s ease",
        overflow: "hidden",
      }}
    >
      {/* ── Trigger row ─────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 18px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
          }}
        >
          Not feeling these?
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* "Just regenerate" ghost link — only visible when open */}
          <button
            type="button"
            onClick={handleJustRegenerate}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
              color: "var(--text-faint)",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              letterSpacing: 0.3,
              opacity: open ? 1 : 0,
              pointerEvents: open ? "auto" : "none",
              transform: open ? "translateX(0)" : "translateX(6px)",
              transition: "opacity 0.2s ease, transform 0.22s ease",
            }}
          >
            Just regenerate
          </button>

          {/* Primary Recalibrate button */}
          <button
            type="button"
            onClick={open ? handleClose : handleOpen}
            disabled={generating}
            aria-expanded={open}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: open
                ? "rgba(126,217,154,0.13)"
                : "rgba(255,255,255,0.05)",
              border: "none",
              boxShadow: open
                ? "0 0 0 1px rgba(126,217,154,0.3)"
                : "0 0 0 1px rgba(255,255,255,0.1)",
              color: open ? "var(--green-bright)" : "var(--text-dim)",
              fontSize: 12,
              fontWeight: 600,
              cursor: generating ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
              opacity: generating ? 0.45 : 1,
              letterSpacing: 0.4,
              transition:
                "background 0.22s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.22s ease, color 0.18s ease, opacity 0.18s ease",
            }}
          >
            {generating ? "Calibrating…" : open ? "✕  Close" : "Recalibrate"}
          </button>
        </div>
      </div>

      {/* ── Tag chips — spring-animated expand ──────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          padding: open ? "0 16px 18px" : "0 16px",
          maxHeight: open ? 160 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          visibility: open ? "visible" : "hidden",
          transition: [
            "max-height 0.36s cubic-bezier(0.175,0.885,0.32,1.275)",
            "opacity 0.24s ease",
            "padding 0.24s ease",
            "visibility 0s linear 0.24s",
          ].join(", "),
        }}
      >
        {TAGS.map((tag, i) => {
          const isHovered = hovered === tag.key;
          return (
            <button
              key={tag.key}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => handleTagSelect(tag.key)}
              onMouseEnter={() => setHovered(tag.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: "13px 12px",
                borderRadius: 14,
                background: isHovered ? tag.activeBg : tag.bg,
                border: "none",
                boxShadow: isHovered
                  ? `0 0 0 1px ${tag.glow}, 0 6px 20px rgba(0,0,0,0.25)`
                  : `0 0 0 1px ${tag.color}22`,
                color: tag.color,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                textAlign: "left",
                opacity: open ? 1 : 0,
                transform: open
                  ? "translateY(0) scale(1)"
                  : "translateY(10px) scale(0.95)",
                transition: [
                  `opacity 0.22s ease ${i * 48}ms`,
                  `transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275) ${i * 48}ms`,
                  "background 0.16s ease",
                  "box-shadow 0.16s ease",
                ].join(", "),
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  display: "block",
                  marginBottom: 6,
                  lineHeight: 1,
                  transition: `transform 0.2s ease ${i * 48}ms`,
                  transform: open ? "scale(1)" : "scale(0.8)",
                }}
              >
                {tag.icon}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  display: "block",
                  letterSpacing: 0.35,
                  lineHeight: 1.2,
                }}
              >
                {tag.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  display: "block",
                  marginTop: 3,
                  lineHeight: 1.3,
                }}
              >
                {tag.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
