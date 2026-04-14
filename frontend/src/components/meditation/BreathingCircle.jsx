import React, { useState, useEffect, useRef, useCallback } from "react";

const PHASES = [
  { name: "Inhale", duration: 4, className: "inhale" },
  { name: "Hold", duration: 7, className: "hold" },
  { name: "Exhale", duration: 8, className: "exhale" },
];

export default function BreathingCircle({ isActive }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [count, setCount] = useState(4);
  const [cycleCount, setCycleCount] = useState(0);
  const timerRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const phase = PHASES[phaseIndex];

  const startCycle = useCallback(() => {
    if (!isActive) return;
    setCount(PHASES[0].duration);
    setPhaseIndex(0);
  }, [isActive]);

  // Count down each second within a phase
  useEffect(() => {
    if (!isActive) {
      setPhaseIndex(0);
      setCount(4);
      setCycleCount(0);
      return;
    }

    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          // Move to next phase
          setPhaseIndex((pi) => {
            const next = (pi + 1) % PHASES.length;
            if (next === 0) {
              setCycleCount((c) => c + 1);
            }
            setCount(PHASES[next].duration);
            return next;
          });
          return 0; // will be overwritten by setCount above
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isActive]);

  // Reset count when phase changes
  useEffect(() => {
    if (isActive) {
      setCount(PHASES[phaseIndex].duration);
    }
  }, [phaseIndex, isActive]);

  return (
    <div className="breathing-circle-container">
      <div
        className={`breathing-circle ${isActive ? phase.className : ""}`}
        key={isActive ? `${phaseIndex}-${cycleCount}` : "idle"}
      >
        <span className="breathing-count">
          {isActive ? count : "∞"}
        </span>
        <span className="breathing-label">
          {isActive ? phase.name : "Ready"}
        </span>
      </div>
      {isActive && (
        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "0.8rem",
            color: "var(--text-dim)",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          Cycle {cycleCount + 1} · {phase.name}
        </p>
      )}
    </div>
  );
}
