import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import GuideMeModal from "./GuideMeModal";
import { useAppState } from "../../contexts/AppStateContext";
import {
  FEATURE_PURPOSE,
  LIFE_PATH_INTRO,
  LIFE_PATH_STATE_LABELS,
  LIFE_PATH_STEPS,
} from "../../data/lifeNavigation";

const PATH_WHISPERS = {
  none: "Start with one honest action. The rest can wait.",
  partial: "You have begun. A reset can help the next step land.",
  all: "Today's action is complete. Reflect when you are ready.",
  restless: "Move gently. Reset before forcing more.",
  weekly: "Your week is pointing toward one quiet theme.",
};

function isTaskComplete(task) {
  return Boolean(task?.completed_at || task?.done);
}

function getCompletedTaskCount(tasks = []) {
  if (!Array.isArray(tasks)) return 0;
  return tasks.filter(isTaskComplete).length;
}

function hasPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function readIntroVisible() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(LIFE_PATH_INTRO.storageKey) !== "true";
  } catch {
    return true;
  }
}

function getStateLabel(step, state) {
  if (state === "current" && step.id === "act") {
    return LIFE_PATH_STATE_LABELS.start;
  }

  return LIFE_PATH_STATE_LABELS[state];
}

export default function TodaysPath({
  isRestless = false,
  hasWeeklyMirrorFocus = false,
}) {
  const navigate = useNavigate();
  const { tasks, stats } = useAppState();
  const [guideOpen, setGuideOpen] = useState(false);
  const [introVisible, setIntroVisible] = useState(readIntroVisible);

  const completedTaskCount = useMemo(() => getCompletedTaskCount(tasks), [tasks]);
  const taskCount = Array.isArray(tasks) ? tasks.length : 0;
  const allTasksCompleted = taskCount > 0 && completedTaskCount >= taskCount;

  const pathWhisper = useMemo(() => {
    if (isRestless) return PATH_WHISPERS.restless;
    if (hasWeeklyMirrorFocus) return PATH_WHISPERS.weekly;
    if (allTasksCompleted) return PATH_WHISPERS.all;
    if (completedTaskCount > 0) return PATH_WHISPERS.partial;
    return PATH_WHISPERS.none;
  }, [allTasksCompleted, completedTaskCount, hasWeeklyMirrorFocus, isRestless]);

  const currentStepId = useMemo(() => {
    if (isRestless) return "reset";
    if (hasWeeklyMirrorFocus || allTasksCompleted) return "reflect";
    if (completedTaskCount > 0) return "reset";
    return "act";
  }, [allTasksCompleted, completedTaskCount, hasWeeklyMirrorFocus, isRestless]);

  const currentIndex = Math.max(
    LIFE_PATH_STEPS.findIndex((step) => step.id === currentStepId),
    0,
  );

  const completedSteps = useMemo(() => ({
    act: completedTaskCount > 0,
    grow: hasPositiveNumber(stats?.lifeScore),
    reflect: hasPositiveNumber(stats?.reflectionsDone),
  }), [completedTaskCount, stats?.lifeScore, stats?.reflectionsDone]);

  const dismissIntro = () => {
    setIntroVisible(false);
    try {
      window.localStorage.setItem(LIFE_PATH_INTRO.storageKey, "true");
    } catch {
      // Local storage is optional; the guide can simply disappear for this render.
    }
  };

  const handleIntroAction = () => {
    dismissIntro();
    navigate("/loop");
  };

  const getStepState = (step, index) => {
    if (step.id === currentStepId) return "current";
    if (completedSteps[step.id]) return "completed";
    if (index === currentIndex + 1) return "suggested";
    return "open";
  };

  return (
    <section className="todays-path-card" aria-labelledby="todays-path-title">
      <div className="todays-path-heading">
        <div>
          <p>Today&apos;s Path</p>
          <h2 id="todays-path-title">Act → Reset → Learn → Grow → Reflect</h2>
          <span>{FEATURE_PURPOSE.dashboard}</span>
        </div>
        <button type="button" onClick={() => setGuideOpen(true)}>
          <Icon name="sparkle" size={15} />
          Guide Me
        </button>
      </div>

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

      <div className="path-whisper" aria-live="polite">
        <span>
          <Icon name="leaf" size={15} />
        </span>
        <p>{pathWhisper}</p>
      </div>

      <div className="todays-path-steps">
        {LIFE_PATH_STEPS.map((step, index) => {
          const state = getStepState(step, index);
          const isCurrent = state === "current";

          return (
            <article
              key={step.id}
              className={`todays-path-step is-${state}${isCurrent ? " is-recommended" : ""}`}
            >
              <div className="todays-path-step-top">
                <span className="todays-path-icon">
                  <Icon name={step.icon} size={17} />
                </span>
                <span className="todays-path-state">
                  {getStateLabel(step, state)}
                </span>
              </div>
              <div className="todays-path-step-copy">
                <p>{step.title}</p>
                <h3>{step.feature}</h3>
                <strong>{step.microcopy}</strong>
                <span>{step.purpose}</span>
              </div>
              <button type="button" onClick={() => navigate(step.path)}>
                {isCurrent ? step.actionLabel : `Open ${step.feature}`}
                <Icon name="arrow" size={13} />
              </button>
            </article>
          );
        })}
      </div>

      <GuideMeModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />

      <style>{`
        .todays-path-card {
          position: relative;
          overflow: hidden;
          min-width: 0;
          margin: 0 0 24px;
          padding: 22px;
          border: 1px solid rgba(126, 217, 154, 0.16);
          border-radius: var(--r-md);
          background:
            radial-gradient(circle at 90% 10%, rgba(46, 204, 113, 0.12), transparent 35%),
            linear-gradient(145deg, rgba(16, 26, 20, 0.82), rgba(7, 12, 10, 0.72));
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
            linear-gradient(90deg, rgba(4, 10, 8, 0.45), transparent 52%),
            radial-gradient(circle at 12% 90%, rgba(240, 165, 0, 0.08), transparent 30%);
        }

        .todays-path-heading,
        .life-path-intro,
        .path-whisper,
        .todays-path-steps {
          position: relative;
          z-index: 1;
        }

        .todays-path-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 16px;
        }

        .todays-path-heading p,
        .life-path-intro p {
          margin: 0 0 8px;
          color: rgba(126, 217, 154, 0.76);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .todays-path-heading h2 {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(24px, 4vw, 34px);
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: 0;
        }

        .todays-path-heading span {
          display: block;
          margin-top: 8px;
          color: var(--text-dim);
          font-size: 13px;
          line-height: 1.5;
        }

        .life-path-intro {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin: 0 0 14px;
          padding: 14px 16px;
          border: 1px solid rgba(126, 217, 154, 0.15);
          border-radius: var(--r-sm);
          background: rgba(255, 255, 255, 0.032);
        }

        .life-path-intro p {
          margin-bottom: 4px;
          font-size: 10px;
          letter-spacing: 1.8px;
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

        .path-whisper {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          margin: 0 0 14px;
          padding: 12px 14px;
          border: 1px solid rgba(126, 217, 154, 0.13);
          border-radius: var(--r-sm);
          background:
            linear-gradient(90deg, rgba(46, 204, 113, 0.07), rgba(255, 255, 255, 0.026));
        }

        .path-whisper span {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(46, 204, 113, 0.2);
          border-radius: 50%;
          color: var(--green-bright);
          background: rgba(46, 204, 113, 0.055);
        }

        .path-whisper p {
          min-width: 0;
          margin: 0;
          color: rgba(236, 241, 232, 0.88);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .todays-path-heading > button,
        .todays-path-step button,
        .life-path-intro-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(46, 204, 113, 0.3);
          border-radius: 999px;
          background: rgba(46, 204, 113, 0.1);
          color: rgba(178, 255, 209, 0.96);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          min-height: 40px;
          padding: 11px 14px;
          white-space: nowrap;
          user-select: none;
        }

        .life-path-intro-actions button:last-child {
          background: transparent;
          border-color: rgba(126, 217, 154, 0.14);
          color: var(--text-dim);
        }

        .todays-path-steps {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          min-width: 0;
          overflow: visible;
        }

        .todays-path-step {
          position: relative;
          min-width: 0;
          min-height: 190px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
          padding: 15px;
          border: 1px solid rgba(126, 217, 154, 0.12);
          border-radius: var(--r-sm);
          background: rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }

        .todays-path-step.is-current {
          border-color: rgba(46, 204, 113, 0.46);
          background:
            radial-gradient(circle at 80% 8%, rgba(46, 204, 113, 0.12), transparent 38%),
            rgba(46, 204, 113, 0.055);
          box-shadow:
            0 0 0 1px rgba(46, 204, 113, 0.08),
            0 0 30px rgba(46, 204, 113, 0.13),
            inset 0 0 26px rgba(46, 204, 113, 0.045);
          animation: pathCurrentPulse 3.8s ease-in-out infinite;
        }

        .todays-path-step.is-completed {
          border-color: rgba(126, 217, 154, 0.22);
          background: rgba(126, 217, 154, 0.04);
        }

        .todays-path-step.is-suggested {
          border-color: rgba(240, 165, 0, 0.23);
          background: rgba(240, 165, 0, 0.035);
        }

        .todays-path-step-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .todays-path-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 50%;
          border: 1px solid rgba(46, 204, 113, 0.2);
          color: var(--green-bright);
          background: rgba(46, 204, 113, 0.055);
        }

        .todays-path-state {
          min-width: 0;
          color: var(--text-faint);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          text-align: right;
          line-height: 1.25;
        }

        .todays-path-step.is-current .todays-path-state {
          color: var(--green-bright);
        }

        .todays-path-step.is-completed .todays-path-state {
          color: rgba(126, 217, 154, 0.86);
        }

        .todays-path-step.is-suggested .todays-path-state {
          color: rgba(240, 165, 0, 0.78);
        }

        .todays-path-step-copy {
          min-width: 0;
        }

        .todays-path-step-copy p {
          margin: 0 0 6px;
          color: var(--text-faint);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .todays-path-step-copy h3 {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 500;
          line-height: 1.08;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .todays-path-step-copy strong {
          display: block;
          margin-top: 9px;
          color: rgba(236, 241, 232, 0.84);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .todays-path-step-copy span {
          display: block;
          margin-top: 7px;
          color: var(--text-dim);
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .todays-path-step button {
          width: 100%;
          min-height: 38px;
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(126, 217, 154, 0.16);
          color: var(--text-dim);
          white-space: normal;
        }

        .todays-path-step.is-current button {
          min-height: 42px;
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          color: #06110a;
          border-color: rgba(46, 204, 113, 0.35);
          box-shadow: 0 14px 30px rgba(46, 204, 113, 0.18);
        }

        @keyframes pathCurrentPulse {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(46, 204, 113, 0.08),
              0 0 26px rgba(46, 204, 113, 0.1),
              inset 0 0 26px rgba(46, 204, 113, 0.045);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(46, 204, 113, 0.14),
              0 0 42px rgba(46, 204, 113, 0.18),
              inset 0 0 30px rgba(46, 204, 113, 0.065);
          }
        }

        @keyframes pathConnectorFlow {
          0% { opacity: 0.35; transform: scaleX(0.7); }
          50% { opacity: 0.95; transform: scaleX(1); }
          100% { opacity: 0.35; transform: scaleX(0.7); }
        }

        @keyframes pathConnectorFlowVertical {
          0% { opacity: 0.35; transform: scaleY(0.7); }
          50% { opacity: 0.95; transform: scaleY(1); }
          100% { opacity: 0.35; transform: scaleY(0.7); }
        }

        @media (prefers-reduced-motion: reduce) {
          .todays-path-step.is-current,
          .todays-path-step.is-current::after {
            animation: none !important;
          }
        }

        @media (min-width: 1101px) {
          .todays-path-step:not(:last-child)::after {
            content: "";
            position: absolute;
            top: 31px;
            right: -11px;
            width: 12px;
            height: 1px;
            background: linear-gradient(90deg, rgba(126, 217, 154, 0.32), transparent);
            transform-origin: left center;
            pointer-events: none;
          }

          .todays-path-step.is-current:not(:last-child)::after {
            height: 2px;
            background: linear-gradient(90deg, rgba(46, 204, 113, 0.95), rgba(46, 204, 113, 0.08));
            animation: pathConnectorFlow 2.6s ease-in-out infinite;
          }
        }

        @media (max-width: 1100px) {
          .todays-path-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 767px) {
          .todays-path-card {
            padding: 18px;
          }

          .todays-path-heading {
            flex-direction: column;
          }

          .life-path-intro {
            grid-template-columns: 1fr;
          }

          .life-path-intro-actions {
            justify-content: stretch;
          }

          .life-path-intro-actions button {
            flex: 1 1 150px;
            min-height: 44px;
          }

          .path-whisper {
            grid-template-columns: 32px minmax(0, 1fr);
            padding: 12px;
          }

          .path-whisper span {
            width: 32px;
            height: 32px;
          }

          .todays-path-heading > button {
            width: 100%;
            min-height: 46px;
          }

          .todays-path-steps {
            grid-template-columns: 1fr;
          }

          .todays-path-step {
            min-height: auto;
          }

          .todays-path-step:not(:last-child)::after {
            content: "";
            position: absolute;
            left: 31px;
            bottom: -11px;
            width: 1px;
            height: 12px;
            background: linear-gradient(180deg, rgba(126, 217, 154, 0.3), transparent);
            transform-origin: center top;
            pointer-events: none;
          }

          .todays-path-step.is-current:not(:last-child)::after {
            width: 2px;
            background: linear-gradient(180deg, rgba(46, 204, 113, 0.95), rgba(46, 204, 113, 0.08));
            animation: pathConnectorFlowVertical 2.6s ease-in-out infinite;
          }

          .todays-path-step button {
            min-height: 44px;
          }
        }
      `}</style>
    </section>
  );
}
