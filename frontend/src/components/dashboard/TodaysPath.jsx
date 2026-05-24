import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../Icon";
import { useAppState } from "../../contexts/AppStateContext";
import { supabase } from "../../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../../lib/appAuth";
import { LIFE_PATH_INTRO, LIFE_PATH_STEPS } from "../../data/lifeNavigation";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const STEP_SHORT = {
  act: "Loop",
  reset: "Reset",
  learn: "Learn",
  grow: "Growth",
  reflect: "Reflect",
};

const HEADER_STEPS = [
  { id: "act", label: "Act" },
  { id: "reset", label: "Reset" },
  { id: "learn", label: "Learn" },
  { id: "grow", label: "Grow" },
  { id: "reflect", label: "Reflect" },
];

const STEP_WHISPERS = {
  act: "Your next honest action is waiting.",
  reset: "Settle your system before forcing action.",
  learn: "Feed your direction with the right ideas.",
  grow: "See your consistency becoming visible.",
  reflect: "Name what today taught you.",
};

function isTaskComplete(task) {
  return Boolean(task?.completed_at || task?.done);
}

function readIntroVisible() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LIFE_PATH_INTRO.storageKey) !== "true";
  } catch {
    return true;
  }
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TodaysPath({ isRestless = false, hasWeeklyMirrorFocus = false }) {
  const navigate = useNavigate();
  const { tasks, stats, user } = useAppState();

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideMessage, setGuideMessage] = useState("");
  const [introVisible, setIntroVisible] = useState(readIntroVisible);
  const dismissTimerRef = useRef(null);

  const completedTaskCount = useMemo(
    () => (Array.isArray(tasks) ? tasks.filter(isTaskComplete).length : 0),
    [tasks],
  );
  const taskCount = Array.isArray(tasks) ? tasks.length : 0;
  const allTasksCompleted = taskCount > 0 && completedTaskCount >= taskCount;
  const allDoneToday = allTasksCompleted && Number(stats?.reflectionsDone) > 0;

  const completedSteps = useMemo(() => ({
    act: completedTaskCount > 0,
    reset: false,
    learn: false,
    grow: Boolean(stats?.lifeScore && stats.lifeScore !== "-"),
    reflect: Number(stats?.reflectionsDone) > 0,
  }), [completedTaskCount, stats?.lifeScore, stats?.reflectionsDone]);

  const currentStepId = useMemo(() => {
    if (isRestless) return "reset";
    if (hasWeeklyMirrorFocus || allTasksCompleted) return "reflect";
    if (completedTaskCount > 0) return "reset";
    return "act";
  }, [allTasksCompleted, completedTaskCount, hasWeeklyMirrorFocus, isRestless]);

  const currentIndex = Math.max(
    LIFE_PATH_STEPS.findIndex((s) => s.id === currentStepId),
    0,
  );

  const getStepState = useCallback((step, index) => {
    if (completedSteps[step.id]) return "completed";
    if (step.id === currentStepId) return "current";
    if (index === currentIndex + 1) return "suggested";
    return "open";
  }, [completedSteps, currentIndex, currentStepId]);

  const connectorState = useCallback((index) => {
    if (index === 0) return null;
    const prevStep = LIFE_PATH_STEPS[index - 1];
    if (completedSteps[prevStep.id]) return "done";
    if (prevStep.id === currentStepId) return "active";
    return "future";
  }, [completedSteps, currentStepId]);

  // ── Guide Me AI panel ────────────────────────────────────────────────────
  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const closeGuide = useCallback(() => {
    clearDismissTimer();
    setGuideOpen(false);
  }, [clearDismissTimer]);

  const fetchGuideMessage = useCallback(async () => {
    if (guideOpen && !guideLoading) {
      closeGuide();
      return;
    }
    setGuideOpen(true);
    setGuideLoading(true);
    setGuideMessage("");
    clearDismissTimer();

    const doneList = Object.entries(completedSteps)
      .filter(([, done]) => done)
      .map(([id]) => STEP_SHORT[id])
      .join(", ") || "none yet";
    const meta = user?.user_metadata ?? {};
    const focuses = (meta.struggle_tags ?? meta.struggles ?? []).slice(0, 3).join(", ") || "clarity";
    const streak = stats?.streak ?? 0;
    const hr = new Date().getHours();
    const tod = hr < 12 ? "morning" : hr < 17 ? "afternoon" : "evening";
    const cur = STEP_SHORT[currentStepId] ?? currentStepId;

    const msg =
      `Guide me on my path. Current step: ${cur}. Steps done today: ${doneList}. ` +
      `Focus areas: ${focuses}. Streak: ${streak} days. Time of day: ${tod}. ` +
      `Give me 2-3 warm, specific sentences on what to do next and why it matters for my journey.`;

    try {
      const token = await getSupabaseOrAppAccessToken(supabase);
      if (!token) throw new Error("no token");
      const res = await fetch(`${API_BASE_URL}/api/life-companion/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "understand_me", message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      setGuideMessage(data?.reply || "Keep going. One honest step is enough.");
    } catch {
      setGuideMessage("Keep going. One honest step is enough.");
    } finally {
      setGuideLoading(false);
      dismissTimerRef.current = setTimeout(closeGuide, 15000);
    }
  }, [clearDismissTimer, closeGuide, completedSteps, currentStepId, guideLoading, guideOpen, stats?.streak, user?.user_metadata]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  // ── Intro banner ─────────────────────────────────────────────────────────
  const dismissIntro = () => {
    setIntroVisible(false);
    try { window.localStorage.setItem(LIFE_PATH_INTRO.storageKey, "true"); } catch { /* ignore */ }
  };
  const handleIntroAction = () => { dismissIntro(); navigate("/loop"); };

  const whisper = STEP_WHISPERS[currentStepId] ?? STEP_WHISPERS.act;

  return (
    <section className="todays-path-card" aria-labelledby="todays-path-title">

      {/* ── PART 3: Alive Header ─────────────────────────────────────────── */}
      <div className="todays-path-heading">
        <div className="tp-header-left">
          <p className="tp-eyebrow">Today&apos;s Path</p>
          <h2 id="todays-path-title" className={`tp-path-line${allDoneToday ? " tp-path-line--all-done" : ""}`}>
            {HEADER_STEPS.map((hs, i) => {
              const done = completedSteps[hs.id];
              const curr = hs.id === currentStepId;
              const cls = done
                ? "ph-step ph-step--done"
                : curr
                  ? "ph-step ph-step--current"
                  : "ph-step ph-step--future";
              const arrowDone = done || (i < currentIndex);
              return (
                <span key={hs.id} className="ph-group">
                  <span className={cls}>{hs.label}</span>
                  {i < HEADER_STEPS.length - 1 && (
                    <span className={`ph-arrow${arrowDone ? " ph-arrow--done" : ""}`}>→</span>
                  )}
                </span>
              );
            })}
          </h2>
        </div>
        <button
          type="button"
          className="guide-me-btn"
          onClick={fetchGuideMessage}
          aria-expanded={guideOpen}
          aria-controls="guide-me-panel"
        >
          <Icon name="sparkle" size={13} />
          Guide Me
        </button>
      </div>

      {/* ── PART 2: AI Guide Me slide-down panel ─────────────────────────── */}
      <AnimatePresence>
        {guideOpen && (
          <motion.div
            id="guide-me-panel"
            className="gm-panel"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto", marginBottom: 14 }}
            exit={{ opacity: 0, y: -6, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="gm-panel-inner">
              {guideLoading ? (
                <div className="gm-shimmer">
                  <div className="gm-shimmer-line gm-shimmer-line--a" />
                  <div className="gm-shimmer-line gm-shimmer-line--b" />
                  <div className="gm-shimmer-line gm-shimmer-line--c" />
                </div>
              ) : (
                <p className="gm-message">{guideMessage}</p>
              )}
              <button type="button" className="gm-close" onClick={closeGuide} aria-label="Dismiss guidance">
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PART 4: One-time intro banner ────────────────────────────────── */}
      {introVisible && (
        <div className="life-path-intro" role="note">
          <div>
            <p>{LIFE_PATH_INTRO.eyebrow}</p>
            <strong>{LIFE_PATH_INTRO.text}</strong>
            <span>{LIFE_PATH_INTRO.prompt}</span>
          </div>
          <div className="life-path-intro-actions">
            <button type="button" onClick={handleIntroAction}>
              {LIFE_PATH_INTRO.actionLabel}
              <Icon name="arrow" size={13} />
            </button>
            <button type="button" onClick={dismissIntro}>
              {LIFE_PATH_INTRO.dismissLabel}
            </button>
          </div>
        </div>
      )}

      {/* ── PART 1: Living Path Stepper ──────────────────────────────────── */}
      <nav className="lp-track" aria-label="Life path steps">
        {LIFE_PATH_STEPS.map((step, index) => {
          const state = getStepState(step, index);
          const isCurrent = state === "current";
          const isDone = state === "completed";
          const isLocked = state === "open" && index > currentIndex + 1;
          const cstate = connectorState(index);

          return (
            <div key={step.id} className="lp-segment">
              {index > 0 && (
                <div className={`lp-line lp-line--${cstate}`} aria-hidden="true">
                  <div className="lp-line-fill" />
                </div>
              )}
              <div className="lp-slot">
                <motion.button
                  className={`lp-dot lp-dot--${state}`}
                  onClick={() => !isLocked && navigate(step.path)}
                  animate={isCurrent ? {
                    boxShadow: [
                      "0 0 0 0px rgba(46,204,113,0.0)",
                      "0 0 0 5px rgba(46,204,113,0.22)",
                      "0 0 0 0px rgba(46,204,113,0.0)",
                    ],
                  } : {}}
                  transition={isCurrent ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : {}}
                  whileHover={!isLocked ? { scale: 1.12 } : {}}
                  whileTap={!isLocked ? { scale: 0.9 } : {}}
                  aria-label={`${STEP_SHORT[step.id]}: ${state}`}
                  aria-current={isCurrent ? "step" : undefined}
                  disabled={isLocked}
                >
                  {isDone ? <CheckIcon /> : null}
                </motion.button>
                <span className={`lp-label lp-label--${state}`}>{STEP_SHORT[step.id]}</span>
                {(isCurrent || isDone || state === "suggested") && (
                  <span className="lp-tag">
                    {isDone ? "✓" : isCurrent ? "Now" : "Next"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Contextual whisper */}
      <div className="path-whisper" aria-live="polite">
        <span aria-hidden="true"><Icon name="leaf" size={14} /></span>
        <p>{whisper}</p>
      </div>

      <style>{`
        /* ── Card shell ────────────────────────────────────────────────── */
        .todays-path-card {
          position: relative;
          overflow: hidden;
          margin: 0 0 24px;
          padding: 22px;
          border: 1px solid rgba(126,217,154,0.16);
          border-radius: var(--r-md);
          background:
            radial-gradient(circle at 90% 10%, rgba(46,204,113,0.12), transparent 35%),
            linear-gradient(145deg, rgba(16,26,20,0.82), rgba(7,12,10,0.72));
          box-shadow: var(--shadow-soft);
          backdrop-filter: blur(24px);
          user-select: none;
          animation: fadeUp 0.6s ease 0.2s both;
        }

        .todays-path-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(4,10,8,0.45), transparent 52%),
            radial-gradient(circle at 12% 90%, rgba(240,165,0,0.08), transparent 30%);
        }

        /* ── Header ────────────────────────────────────────────────────── */
        .todays-path-heading {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }

        .tp-eyebrow {
          margin: 0 0 8px;
          color: rgba(126,217,154,0.76);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        /* ── PART 3: Alive path-line header ─────────────────────────── */
        .tp-path-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 2px;
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(18px, 3.2vw, 28px);
          font-weight: 500;
          line-height: 1.15;
          letter-spacing: 0;
        }

        .ph-group {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .ph-step {
          transition: color 0.4s ease, text-shadow 0.4s ease;
        }

        .ph-step--done {
          color: var(--green-bright);
          text-shadow: 0 0 16px rgba(46,204,113,0.35);
        }

        .ph-step--current {
          color: var(--text);
          font-weight: 600;
          position: relative;
          background: linear-gradient(
            90deg,
            var(--text) 0%,
            rgba(46,204,113,0.9) 50%,
            var(--text) 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: headerShimmer 3s linear infinite;
        }

        .ph-step--future {
          color: var(--text-faint);
        }

        .ph-arrow {
          color: var(--text-faint);
          font-size: 0.8em;
          transition: color 0.4s ease, text-shadow 0.4s ease;
        }

        .ph-arrow--done {
          color: var(--green-bright);
          text-shadow: 0 0 8px rgba(46,204,113,0.5);
        }

        /* All done: golden */
        .tp-path-line--all-done .ph-step,
        .tp-path-line--all-done .ph-arrow {
          color: #F0C060;
          -webkit-text-fill-color: #F0C060;
          background: none;
          text-shadow: 0 0 18px rgba(240,192,96,0.4);
          animation: goldGlow 2.4s ease-in-out infinite;
        }

        @keyframes headerShimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        @keyframes goldGlow {
          0%, 100% { text-shadow: 0 0 14px rgba(240,192,96,0.35); }
          50%       { text-shadow: 0 0 28px rgba(240,192,96,0.65); }
        }

        /* ── Guide Me button ─────────────────────────────────────────── */
        .guide-me-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          border: 1px solid rgba(46,204,113,0.3);
          border-radius: 999px;
          background: rgba(46,204,113,0.1);
          color: rgba(178,255,209,0.96);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          min-height: 36px;
          padding: 9px 14px;
          white-space: nowrap;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .guide-me-btn:hover {
          background: rgba(46,204,113,0.18);
          border-color: rgba(46,204,113,0.5);
        }

        /* ── PART 2: AI Guide Me slide-down panel ───────────────────── */
        .gm-panel {
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .gm-panel-inner {
          display: grid;
          grid-template-columns: minmax(0,1fr) 28px;
          gap: 12px;
          align-items: start;
          padding: 14px 16px;
          border: 1px solid rgba(46,204,113,0.22);
          border-radius: var(--r-sm);
          background:
            linear-gradient(135deg, rgba(14,28,20,0.92), rgba(8,16,12,0.88));
          backdrop-filter: blur(20px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(46,204,113,0.1);
        }

        .gm-message {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 400;
          line-height: 1.65;
          letter-spacing: 0.01em;
        }

        .gm-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: 1px solid rgba(126,217,154,0.15);
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          color: var(--text-faint);
          cursor: pointer;
          font-size: 12px;
          padding: 0;
          margin-top: 1px;
          flex-shrink: 0;
          transition: background 0.18s ease, color 0.18s ease;
        }

        .gm-close:hover {
          background: rgba(255,255,255,0.08);
          color: var(--text-dim);
        }

        /* Shimmer loader */
        .gm-shimmer {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 2px 0;
        }

        .gm-shimmer-line {
          border-radius: 4px;
          background: linear-gradient(
            90deg,
            rgba(46,204,113,0.06) 0%,
            rgba(46,204,113,0.14) 40%,
            rgba(46,204,113,0.06) 100%
          );
          background-size: 200% 100%;
          animation: shimmerSlide 1.6s ease-in-out infinite;
        }

        .gm-shimmer-line--a { height: 14px; width: 92%; }
        .gm-shimmer-line--b { height: 14px; width: 78%; animation-delay: 0.15s; }
        .gm-shimmer-line--c { height: 14px; width: 55%; animation-delay: 0.3s; }

        @keyframes shimmerSlide {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        /* ── One-time intro banner ───────────────────────────────────── */
        .life-path-intro {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 16px;
          align-items: center;
          margin: 0 0 14px;
          padding: 14px 16px;
          border: 1px solid rgba(126,217,154,0.15);
          border-radius: var(--r-sm);
          background: rgba(255,255,255,0.032);
        }

        .life-path-intro p {
          margin: 0 0 4px;
          color: rgba(126,217,154,0.76);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .life-path-intro strong {
          display: block;
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
        }

        .life-path-intro span {
          display: block;
          margin-top: 4px;
          color: var(--text-dim);
          font-size: 13px;
          line-height: 1.45;
        }

        .life-path-intro-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .life-path-intro-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(46,204,113,0.3);
          border-radius: 999px;
          background: rgba(46,204,113,0.1);
          color: rgba(178,255,209,0.96);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          min-height: 38px;
          padding: 10px 14px;
          white-space: nowrap;
        }

        .life-path-intro-actions button:last-child {
          background: transparent;
          border-color: rgba(126,217,154,0.14);
          color: var(--text-dim);
        }

        /* ── PART 1: Living Path Stepper ─────────────────────────────── */
        .lp-track {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          padding: 14px 0 6px;
          min-width: 0;
        }

        /* Each segment = optional connector + node-column */
        .lp-segment {
          display: contents;
        }

        /* Connector line between nodes */
        .lp-line {
          flex: 1;
          min-width: 8px;
          height: 2px;
          margin-top: 14px; /* centers on the 28px dot */
          border-radius: 2px;
          overflow: visible;
          position: relative;
        }

        .lp-line-fill {
          width: 100%;
          height: 100%;
          border-radius: inherit;
        }

        .lp-line--done .lp-line-fill {
          background: linear-gradient(90deg, var(--green), var(--green-bright));
          box-shadow: 0 0 6px rgba(46,204,113,0.5);
        }

        .lp-line--active .lp-line-fill {
          background: linear-gradient(
            90deg,
            rgba(46,204,113,0.25),
            rgba(46,204,113,0.85),
            rgba(46,204,113,0.25)
          );
          background-size: 200% 100%;
          animation: lineFlow 2.2s ease-in-out infinite;
          box-shadow: 0 0 4px rgba(46,204,113,0.3);
        }

        .lp-line--future .lp-line-fill {
          background: rgba(126,217,154,0.12);
          border-top: 1px dashed rgba(126,217,154,0.2);
          height: 0;
          margin-top: 1px;
        }

        @keyframes lineFlow {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        /* Node column */
        .lp-slot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          min-width: 44px;
        }

        /* Dot (the circle node) */
        .lp-dot {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 2px solid rgba(126,217,154,0.2);
          background: rgba(255,255,255,0.03);
          color: var(--green-bright);
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: border-color 0.3s ease, background 0.3s ease;
        }

        .lp-dot:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .lp-dot--completed {
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          border-color: var(--green-bright);
          color: #042810;
          box-shadow: 0 0 10px rgba(46,204,113,0.35);
        }

        .lp-dot--current {
          width: 34px;
          height: 34px;
          border: 2px solid var(--green-bright);
          background: rgba(46,204,113,0.12);
          box-shadow: 0 0 14px rgba(46,204,113,0.28);
          margin-top: -3px; /* compensate for larger size to keep label alignment */
        }

        .lp-dot--suggested {
          border-color: rgba(240,165,0,0.45);
          background: rgba(240,165,0,0.06);
          color: rgba(240,165,0,0.9);
        }

        .lp-dot--open {
          border-color: rgba(126,217,154,0.12);
          background: transparent;
          opacity: 0.45;
        }

        /* Step label */
        .lp-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-align: center;
          white-space: nowrap;
          line-height: 1;
        }

        .lp-label--completed { color: rgba(126,217,154,0.9); }
        .lp-label--current   { color: var(--text); }
        .lp-label--suggested { color: rgba(240,165,0,0.8); }
        .lp-label--open      { color: var(--text-faint); }

        /* State tag (✓ / Now / Next) */
        .lp-tag {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text-faint);
          line-height: 1;
        }

        .lp-dot--completed + .lp-label + .lp-tag,
        .lp-dot--completed ~ .lp-tag { color: rgba(126,217,154,0.7); }
        .lp-dot--current   ~ .lp-tag { color: var(--green-bright); }
        .lp-dot--suggested ~ .lp-tag { color: rgba(240,165,0,0.65); }

        /* ── Contextual whisper ──────────────────────────────────────── */
        .path-whisper {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 30px minmax(0,1fr);
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(126,217,154,0.12);
          border-radius: var(--r-sm);
          background: linear-gradient(90deg, rgba(46,204,113,0.06), rgba(255,255,255,0.02));
        }

        .path-whisper span {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(46,204,113,0.18);
          border-radius: 50%;
          color: var(--green-bright);
          background: rgba(46,204,113,0.05);
        }

        .path-whisper p {
          margin: 0;
          color: rgba(236,241,232,0.88);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        /* ── Mobile ──────────────────────────────────────────────────── */
        @media (max-width: 767px) {
          .todays-path-card { padding: 18px; }

          .todays-path-heading {
            flex-direction: column;
            gap: 12px;
          }

          .guide-me-btn {
            width: 100%;
            min-height: 44px;
            justify-content: center;
          }

          .life-path-intro {
            grid-template-columns: 1fr;
          }

          .life-path-intro-actions {
            flex-direction: column;
          }

          .life-path-intro-actions button {
            width: 100%;
            min-height: 44px;
          }

          .lp-track {
            padding: 10px 0 4px;
          }

          .lp-slot {
            min-width: 34px;
          }

          .lp-dot { width: 24px; height: 24px; }
          .lp-dot--current { width: 28px; height: 28px; margin-top: -2px; }
          .lp-line { margin-top: 11px; }

          .lp-label { font-size: 9px; }
          .lp-tag   { display: none; }

          .path-whisper {
            grid-template-columns: 28px minmax(0,1fr);
            padding: 10px;
          }

          .path-whisper span {
            width: 28px;
            height: 28px;
          }
        }

        @media (max-width: 400px) {
          .lp-slot { min-width: 28px; }
          .lp-dot  { width: 20px; height: 20px; }
          .lp-dot--current { width: 24px; height: 24px; margin-top: -2px; }
          .lp-line { margin-top: 9px; }
          .lp-label { font-size: 8px; letter-spacing: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-dot--current,
          .gm-shimmer-line,
          .lp-line--active .lp-line-fill,
          .ph-step--current { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
