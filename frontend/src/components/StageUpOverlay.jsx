/**
 * StageUpOverlay — Quiet celebration when the user reaches a new growth stage.
 * Shows new tree image, stage name, and encouragement for 3 seconds.
 * No confetti, no bounce — just soft glow, opacity, and filters.
 */
import { useState, useEffect } from "react";

export default function StageUpOverlay({ stageUp, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (stageUp) {
      setVisible(true);
      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFadeIn(true));
      });
      // Auto-dismiss
      const timer = setTimeout(() => {
        setFadeIn(false);
        setTimeout(() => {
          setVisible(false);
          if (onDismiss) onDismiss();
        }, 600);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setFadeIn(false);
      setTimeout(() => setVisible(false), 600);
    }
  }, [stageUp]);

  if (!visible || !stageUp) return null;

  const { to } = stageUp;

  return (
    <div
      onClick={() => {
        setFadeIn(false);
        setTimeout(() => {
          setVisible(false);
          if (onDismiss) onDismiss();
        }, 400);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fadeIn
          ? "rgba(5, 8, 6, 0.85)"
          : "rgba(5, 8, 6, 0)",
        backdropFilter: fadeIn ? "blur(12px)" : "blur(0px)",
        transition: "all 0.6s ease",
        cursor: "pointer",
      }}
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: fadeIn ? "translateY(0)" : "translateY(24px)",
        opacity: fadeIn ? 1 : 0,
        transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        {/* Glow ring */}
        <div style={{
          position: "relative",
          width: 260,
          height: 260,
        }}>
          {/* Outer glow */}
          <div style={{
            position: "absolute",
            inset: -20,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(46,204,113,0.15), transparent 70%)",
            animation: fadeIn ? "stageGlowPulse 2s ease infinite" : "none",
          }} />
          {/* Tree image */}
          <img
            src={to.image}
            alt={to.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 0 24px rgba(46,204,113,0.3))",
            }}
          />
        </div>

        {/* Stage name */}
        <h2 style={{
          margin: 0,
          fontSize: 28,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          color: "var(--green-bright)",
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}>
          {to.name}
        </h2>

        {/* Message */}
        <p style={{
          margin: 0,
          fontSize: 16,
          fontFamily: "var(--font-body)",
          color: "rgba(232,232,227,0.7)",
          textAlign: "center",
          maxWidth: 300,
          lineHeight: 1.5,
        }}>
          {to.message}
        </p>

        {/* Subtle dismiss hint */}
        <p style={{
          margin: "12px 0 0",
          fontSize: 11,
          color: "rgba(232,232,227,0.25)",
          fontFamily: "var(--font-body)",
        }}>
          tap anywhere to continue
        </p>
      </div>

      <style>{`
        @keyframes stageGlowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
