import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import { readChain, getAdvancedPrimaryFeature } from "../../hooks/useContinuationChain";
import { useAppState } from "../../contexts/AppStateContext";
import { isCoreLoopTask } from "../../hooks/useLoopTasks";

// Zone 2 — the one thing the dashboard asks. More visual weight than the
// grid below; the grid is discovery, this is the hierarchy.

export default function PrimaryActionCard({ payload }) {
  const navigate = useNavigate();
  // Live count from AppStateContext's own tasks state — refreshed by
  // useLoopTasks' toggleTask() immediately after every completion — bypasses
  // /api/dashboard's 15-minute cache for the all-complete check below.
  const { tasks: liveTasks } = useAppState();
  const liveTasksCompletedToday = (liveTasks || [])
    .filter(isCoreLoopTask)
    .filter((task) => task.completed_at).length;
  // Crisis wins over the all-done swap (2026-07-18 audit, Finding 1):
  // without this gate, a crisis user who had finished their tasks saw
  // "Both tasks complete / See your tree" instead of the companion card —
  // and since FeatureGrid filters out the primary feature, Companion
  // vanished from every zone. The spec's two rules conflict here; the
  // crisis-overrides-all rule is the one that must hold.
  const crisisActive = Boolean(payload?.season?.crisis_active);
  const allDone = Boolean(payload?.tasks_today?.all_done) && !crisisActive;
  const action = payload?.primary_action || {};

  // Phase 1.5 Part B — the primary action advances past whatever's already
  // completed, instead of sitting on the orchestrator's top pick forever.
  // getAdvancedPrimaryFeature is shared with FeatureGrid, which needs to
  // exclude this SAME feature from its own grid — otherwise a just-advanced
  // primary can end up neither shown here nor visible (with its checkmark)
  // there. Conservative pool (no live reflections count) for the
  // all-complete check specifically — avoids adding a network call to the
  // dashboard's mount; getStagePool's existing fail-closed handling already
  // treats a missing seasonStats as 0 reflections. Known trade-off, logged
  // like the dashboard-cache item: a user who unlocked stage 3 via a journal
  // entry alone (not via 2 completed tasks) may see all-complete one step
  // early here — the chain's own mid-session cards, which do fetch live
  // reflection data, are unaffected.
  const { completed } = readChain();
  const { card, isAllComplete } = getAdvancedPrimaryFeature(payload, completed, liveTasksCompletedToday);

  const isOrchestratorTop = card?.feature === action.feature;
  const label = isAllComplete ? "TODAY" : "Today's Focus";
  const headline = isAllComplete ? "You showed up today." : (card?.headline || action.headline);
  const sub = isAllComplete ? "That's the whole thing." : (isOrchestratorTop ? action.sub : null);
  // Part C — status is always state, never a fraction/count/percentage.
  const statusText = isAllComplete ? "Done today" : "Not yet started";
  const ctaText = "Begin →";
  const ctaRoute = card?.route || action.cta_route;
  const borderColor = isAllComplete ? "var(--green)" : "var(--green-bright)";

  return (
    <section
      className="dashboard-primary-action"
      aria-label={label}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <img
        src="/media/dashboard/focus_mountain_landscape.png"
        alt=""
        aria-hidden="true"
        className="dashboard-primary-bg-image"
      />
      <div className="dashboard-primary-bg-gradient" aria-hidden="true" />
      <div className="dashboard-primary-bg-tint" aria-hidden="true" />

      <div className="dashboard-primary-content">
        <p className="dashboard-primary-label">{label}</p>
        <div className="dashboard-primary-body">
          <div className="dashboard-primary-icon" aria-hidden="true">
            <Icon name="sprout" size={40} color="var(--green-bright)" strokeWidth={1.3} />
          </div>
          <div className="dashboard-primary-text">
            <h2>{headline}</h2>
            {sub ? <p className="dashboard-primary-sub">{sub}</p> : null}
            <div className="dashboard-primary-status">
              <span
                className={`dashboard-primary-status-checkbox${isAllComplete ? " is-checked" : ""}`}
                aria-hidden="true"
              >
                {isAllComplete && <Icon name="check" size={11} color="var(--bg)" strokeWidth={2.5} />}
              </span>
              <span className="dashboard-primary-status-text">{statusText}</span>
            </div>
            {!isAllComplete && (
              <div className="dashboard-primary-cta-row">
                <button
                  type="button"
                  className="dashboard-primary-cta"
                  onClick={() => ctaRoute && navigate(ctaRoute)}
                >
                  {ctaText}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-primary-action {
          position: relative;
          overflow: hidden;
          margin: 24px 0 0;
          padding: 20px 24px;
          border-radius: var(--r-md);
          background: var(--bg-card-solid);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.40);
        }

        .dashboard-primary-bg-image {
          position: absolute;
          top: 0;
          right: 0;
          z-index: 0;
          width: 45%;
          height: 100%;
          object-fit: cover;
          opacity: 0.55;
          pointer-events: none;
          mask-image: linear-gradient(to right, transparent 0%, transparent 30%, rgba(0, 0, 0, 0.5) 45%, black 65%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 30%, rgba(0, 0, 0, 0.5) 45%, black 65%);
        }

        .dashboard-primary-bg-gradient {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(to right, var(--bg-card-solid) 30%, transparent 100%);
          pointer-events: none;
        }

        .dashboard-primary-bg-tint {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(135deg, transparent 40%, rgba(183, 121, 31, 0.15) 100%);
          pointer-events: none;
        }

        .dashboard-primary-content {
          position: relative;
          z-index: 1;
        }

        .dashboard-primary-label {
          margin: 0;
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
        }

        .dashboard-primary-action h2 {
          margin: 0;
          color: #FFFFFF;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.60);
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 500;
          line-height: 1.15;
        }

        .dashboard-primary-body {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 10px;
        }

        .dashboard-primary-icon {
          flex-shrink: 0;
          width: 110px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(46, 204, 113, 0.08);
          border: 1px solid var(--green-bright);
        }

        .dashboard-primary-text {
          min-width: 0;
        }

        .dashboard-primary-sub {
          margin: 8px 0 0;
          color: var(--text-dim);
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.5;
        }

        .dashboard-primary-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }

        .dashboard-primary-status-checkbox {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          border: 1px solid var(--text-faint);
        }

        .dashboard-primary-status-checkbox.is-checked {
          background: var(--green-bright);
          border-color: var(--green-bright);
        }

        .dashboard-primary-status-text {
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 13px;
        }

        .dashboard-primary-cta-row {
          display: flex;
          justify-content: flex-start;
          margin-top: 24px;
        }

        .dashboard-primary-cta {
          min-height: 44px;
          width: 100%;
          padding: 10px 22px;
          border: 1px solid rgba(46, 204, 113, 0.35);
          border-radius: var(--r-sm);
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          color: var(--bg);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 18px var(--green-glow);
          transition: transform 0.2s ease-in-out;
        }

        .dashboard-primary-cta:hover {
          transform: translateY(-1px);
        }

        @media (min-width: 768px) {
          .dashboard-primary-cta {
            width: auto;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-primary-cta {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
