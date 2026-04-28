/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useAppState } from "../../contexts/AppStateContext";

export default function FocusTimer({ defaultMinutes = 25 }) {
  const { focusSession, startFocus, endFocus } = useAppState();
  const [seconds, setSeconds] = useState(defaultMinutes * 60);

  const running = focusSession?.active === true;

  // Sync seconds from session start time so the countdown
  // continues correctly on page navigation.
  useEffect(() => {
    if (!running) {
      setSeconds(defaultMinutes * 60);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(focusSession.startedAt)) / 1000
      );
      const remaining = focusSession.duration - elapsed;
      if (remaining <= 0) {
        endFocus(true);   // completed
      } else {
        setSeconds(remaining);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [running, focusSession, endFocus, defaultMinutes]);

  const toggle = () => {
    if (running) endFocus(false);
    else startFocus(defaultMinutes);
  };

  const mm = String(Math.floor(seconds / 60))
    .padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pct = ((defaultMinutes * 60 - seconds)
    / (defaultMinutes * 60)) * 100;

  return (
    <div style={{
      position: "relative",
      borderRadius: "var(--r-md)",
      overflow: "hidden",
      minHeight: 228,
      boxShadow: "var(--shadow-lift)",
    }}>
      {/* Background image */}
      <img
        src="/media/focus-forest.jpg"
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          transform: running
            ? `translateX(-${pct * 0.3}%)`
            : "translateX(0)",
          transition: "transform 60s linear",
        }}
      />

      {/* Dark overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, "
          + "rgba(10,15,13,0.35) 0%, "
          + "rgba(10,15,13,0.65) 100%)",
      }} />

      {/* Progress ring border */}
      {running && (
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "var(--r-md)",
          border: "2px solid transparent",
          background: `conic-gradient(
            from -90deg,
            var(--green-bright) 0%,
            var(--green-bright) ${pct}%,
            transparent ${pct}%
          ) border-box`,
          WebkitMask: "linear-gradient(#fff 0 0) "
            + "padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          pointerEvents: "none",
        }} />
      )}

      {/* Header */}
      <div style={{
        position: "relative",
        display: "flex",
        justifyContent: "space-between",
        padding: "20px 24px 0",
      }}>
        <h3 style={{
          margin: 0, fontSize: 11, fontWeight: 500,
          letterSpacing: 2.5, textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          Focus Timer
        </h3>
        <button style={{
          background: "none", border: "none",
          color: "var(--text-dim)",
          fontFamily: "var(--font-body)", fontSize: 12,
          cursor: "pointer",
        }}>
          Customize &rarr;
        </button>
      </div>

      {/* Timer */}
      <div style={{
        position: "relative",
        textAlign: "center",
        padding: "16px 0 28px",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 72, fontWeight: 300,
          color: "var(--text)",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: 2,
        }}>
          {mm}:{ss}
        </div>
        <p style={{
          margin: "6px 0 18px",
          fontSize: 13, color: "var(--text-dim)",
          fontFamily: "var(--font-body)",
        }}>
          Stay Focused
        </p>
        <button
          onClick={toggle}
          style={{
            padding: "10px 28px",
            background: running
              ? "rgba(240,165,0,0.15)"
              : "linear-gradient(135deg, var(--green) 0%, "
                + "var(--green-bright) 100%)",
            border: running
              ? "1px solid rgba(240,165,0,0.4)" : "none",
            borderRadius: 20,
            color: running ? "var(--amber)" : "white",
            fontFamily: "var(--font-body)",
            fontWeight: 500, fontSize: 14,
            cursor: "pointer",
            boxShadow: running
              ? "none" : "0 4px 20px var(--green-glow)",
            transition: "all 0.3s",
          }}
        >
          {running ? "End Focus" : "Start Focus"}
        </button>
      </div>
    </div>
  );
}
