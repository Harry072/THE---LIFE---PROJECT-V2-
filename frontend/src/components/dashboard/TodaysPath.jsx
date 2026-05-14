import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import GuideMeModal from "./GuideMeModal";
import { FEATURE_PURPOSE, LIFE_PATH_STEPS } from "../../data/lifeNavigation";

export default function TodaysPath() {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);

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

      <div className="todays-path-steps">
        {LIFE_PATH_STEPS.map((step, index) => {
          const isCurrent = index === 0;

          return (
            <article
              key={step.id}
              className={`todays-path-step${isCurrent ? " is-current" : ""}`}
            >
              <div className="todays-path-step-top">
                <span className="todays-path-icon">
                  <Icon name={step.icon} size={17} />
                </span>
                <span className="todays-path-state">
                  {isCurrent ? "Current" : step.stateLabel}
                </span>
              </div>
              <div>
                <p>{step.order}. {step.title}</p>
                <h3>{step.feature}</h3>
                <span>{step.purpose}</span>
              </div>
              <button type="button" onClick={() => navigate(step.path)}>
                Open
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
          margin: 0 0 24px;
          padding: 22px;
          border: 1px solid rgba(126, 217, 154, 0.16);
          border-radius: var(--r-md);
          background:
            radial-gradient(circle at 90% 10%, rgba(46, 204, 113, 0.12), transparent 35%),
            linear-gradient(145deg, rgba(16, 26, 20, 0.82), rgba(7, 12, 10, 0.72));
          box-shadow: var(--shadow-soft);
          backdrop-filter: blur(24px);
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
        .todays-path-steps {
          position: relative;
          z-index: 1;
        }

        .todays-path-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .todays-path-heading p {
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

        .todays-path-heading > button,
        .todays-path-step button {
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
        }

        .todays-path-steps {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .todays-path-step {
          min-width: 0;
          min-height: 210px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          padding: 15px;
          border: 1px solid rgba(126, 217, 154, 0.12);
          border-radius: var(--r-sm);
          background: rgba(255, 255, 255, 0.03);
        }

        .todays-path-step.is-current {
          border-color: rgba(46, 204, 113, 0.36);
          background: rgba(46, 204, 113, 0.055);
          box-shadow: inset 0 0 24px rgba(46, 204, 113, 0.045);
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

        .todays-path-step p {
          margin: 0 0 5px;
          color: var(--text-faint);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }

        .todays-path-step h3 {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 500;
          line-height: 1.08;
          letter-spacing: 0;
        }

        .todays-path-step div > span:not(.todays-path-icon):not(.todays-path-state) {
          display: block;
          margin-top: 9px;
          color: var(--text-dim);
          font-size: 12px;
          line-height: 1.5;
        }

        .todays-path-step button {
          width: 100%;
          min-height: 38px;
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(126, 217, 154, 0.16);
          color: var(--text-dim);
        }

        .todays-path-step.is-current button {
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          color: #06110a;
          border-color: rgba(46, 204, 113, 0.35);
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

          .todays-path-step button {
            min-height: 44px;
          }
        }
      `}</style>
    </section>
  );
}
