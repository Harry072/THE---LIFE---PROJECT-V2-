import { useNavigate } from "react-router-dom";
import Icon from "../Icon";

// Zone 2 — the one thing the dashboard asks. More visual weight than the
// grid below; the grid is discovery, this is the hierarchy.

export default function PrimaryActionCard({ payload }) {
  const navigate = useNavigate();
  // Crisis wins over the all-done swap (2026-07-18 audit, Finding 1):
  // without this gate, a crisis user who had finished their tasks saw
  // "Both tasks complete / See your tree" instead of the companion card —
  // and since FeatureGrid filters out the primary feature, Companion
  // vanished from every zone. The spec's two rules conflict here; the
  // crisis-overrides-all rule is the one that must hold.
  const crisisActive = Boolean(payload?.season?.crisis_active);
  const allDone = Boolean(payload?.tasks_today?.all_done) && !crisisActive;
  const action = payload?.primary_action || {};

  const label = allDone ? "Today's Loop" : "Today's Focus";
  const headline = allDone ? "Both tasks complete." : action.headline;
  const sub = allDone ? "Small actions become identity." : action.sub;
  const ctaText = allDone ? "See your tree →" : action.cta_text;
  const ctaRoute = allDone ? "/progress" : action.cta_route;
  const borderColor = allDone ? "var(--green)" : "var(--green-bright)";

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

      <div className="dashboard-primary-content">
        <p className="dashboard-primary-label">{label}</p>
        <div className="dashboard-primary-body">
          <div className="dashboard-primary-icon" aria-hidden="true">
            <Icon name="compass" size={24} color="var(--green-bright)" />
          </div>
          <div className="dashboard-primary-text">
            <h2>{headline}</h2>
            {sub ? <p className="dashboard-primary-sub">{sub}</p> : null}
          </div>
        </div>
        <div className="dashboard-primary-cta-row">
          <button
            type="button"
            className="dashboard-primary-cta"
            onClick={() => ctaRoute && navigate(ctaRoute)}
          >
            {ctaText}
          </button>
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
          box-shadow: var(--shadow-soft);
        }

        .dashboard-primary-bg-image {
          position: absolute;
          top: 0;
          right: 0;
          z-index: 0;
          width: 45%;
          height: 100%;
          object-fit: cover;
          opacity: 0.35;
        }

        .dashboard-primary-bg-gradient {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(to right, var(--bg-card-solid) 30%, transparent 100%);
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
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(24px, 3.4vw, 34px);
          font-weight: 500;
          line-height: 1.15;
        }

        .dashboard-primary-body {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 10px;
        }

        .dashboard-primary-icon {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(46, 204, 113, 0.15);
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

        .dashboard-primary-cta-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 18px;
        }

        .dashboard-primary-cta {
          min-height: 44px;
          width: 100%;
          padding: 10px 22px;
          border: 1px solid rgba(46, 204, 113, 0.35);
          border-radius: var(--r-sm);
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          color: #07100B;
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
