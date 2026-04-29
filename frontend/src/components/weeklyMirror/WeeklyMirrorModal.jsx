import { useEffect, useMemo, useState } from "react";
import Icon from "../Icon";

const LOADING_LINES = [
  "Looking at your inner weather...",
  "Noticing repeated patterns...",
  "Finding one useful focus...",
];

const RESULT_SECTIONS = [
  ["Inner Weather Pattern", "inner_weather_pattern"],
  ["Repeated Theme", "repeated_theme"],
  ["What Helped You Move Forward", "helped_forward"],
  ["What Kept Pulling You Back", "pulled_back"],
  ["One Question for Next Week", "weekly_question"],
];

export default function WeeklyMirrorModal({
  isOpen,
  phase,
  synthesis,
  status,
  error,
  onClose,
  onReveal,
  onCarryFocus,
  onRecommendationAction,
}) {
  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (phase !== "loading") return undefined;
    const timer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % LOADING_LINES.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [phase]);

  const resultCards = useMemo(() => (
    RESULT_SECTIONS.map(([title, key]) => ({
      title,
      value: synthesis?.[key],
    })).filter((item) => item.value)
  ), [synthesis]);
  const recommendation = synthesis?.recommended_next_step;

  if (!isOpen) return null;

  const isFallback = status === "fallback";
  const isInsufficient = phase === "insufficient_data";
  const canShowResult = phase === "result" || phase === "fallback";

  return (
    <div
      className="weekly-mirror-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="weekly-mirror-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-mirror-title"
      >
        <button
          type="button"
          className="weekly-mirror-close"
          aria-label="Close Weekly Mirror"
          onClick={onClose}
        >
          <Icon name="plus" size={16} style={{ transform: "rotate(45deg)" }} />
        </button>

        <div className="weekly-mirror-content-scroll">
        {phase === "intro" && (
          <div className="weekly-mirror-intro">
            <div className="weekly-mirror-rings" aria-hidden="true" />
            <p className="weekly-mirror-kicker">Weekly Mirror</p>
            <h2 id="weekly-mirror-title">
              Take one breath.
              <span>This is not a scorecard.</span>
              <span>It is only a mirror.</span>
            </h2>
            <button type="button" className="weekly-mirror-primary" onClick={onReveal}>
              Show me the pattern
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="weekly-mirror-loading">
            <div className="weekly-mirror-loader" aria-hidden="true" />
            <h2 id="weekly-mirror-title">Reading the week quietly...</h2>
            <p role="status" aria-live="polite">{LOADING_LINES[loadingIndex]}</p>
          </div>
        )}

        {isInsufficient && (
          <div className="weekly-mirror-empty">
            <p className="weekly-mirror-kicker">Mirror Forming</p>
            <h2 id="weekly-mirror-title">Your mirror is still forming.</h2>
            <p>
              {synthesis?.week_sentence
                || "Save a few reflections and complete small tasks this week."}
            </p>
            <div className="weekly-mirror-soft-card">
              {synthesis?.next_focus || "Leave one honest trace each day."}
            </div>
            <button type="button" className="weekly-mirror-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="weekly-mirror-empty">
            <p className="weekly-mirror-kicker">Weekly Mirror</p>
            <h2 id="weekly-mirror-title">The mirror could not form right now.</h2>
            <p>{error || "Try again in a little while."}</p>
            <button type="button" className="weekly-mirror-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {canShowResult && (
          <div className="weekly-mirror-result">
            <div className="weekly-mirror-result-header">
              <div>
                <p className="weekly-mirror-kicker">Weekly Mirror</p>
                <h2 id="weekly-mirror-title">Your Week in One Sentence</h2>
              </div>
              {isFallback && <span className="weekly-mirror-status">Gentle fallback</span>}
            </div>

            <article className="weekly-mirror-hero-card">
              {synthesis?.week_sentence}
            </article>

            <div className="weekly-mirror-section-list">
              {resultCards.map((item) => (
                <article key={item.title} className="weekly-mirror-section-card">
                  <h3>{item.title}</h3>
                  <p>{item.value}</p>
                </article>
              ))}
            </div>

            {recommendation && (
              <article className="weekly-mirror-recommendation-card">
                <div>
                  <p className="weekly-mirror-kicker">Recommended for You</p>
                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.reason}</p>
                </div>
                <button
                  type="button"
                  className="weekly-mirror-recommendation-button"
                  onClick={() => onRecommendationAction?.(recommendation)}
                >
                  {recommendation.action_label || "Open"}
                </button>
              </article>
            )}

            <article className="weekly-mirror-focus-card">
              <p className="weekly-mirror-kicker">Next Week Focus</p>
              <h3>{synthesis?.next_focus || "Begin smaller, but begin honestly."}</h3>
              <p>Keep the promise small enough to begin.</p>
              <button
                type="button"
                className="weekly-mirror-primary"
                onClick={() => {
                  onCarryFocus?.();
                  onClose?.();
                }}
              >
                Carry This Into Next Week
              </button>
            </article>
          </div>
        )}
        </div>
      </section>

      <style>{`
        .weekly-mirror-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 240px;
          z-index: 130;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(14px);
        }

        .weekly-mirror-shell {
          position: relative;
          width: 100%;
          max-width: min(100%, 1200px);
          max-height: calc(100vh - 32px);
          max-height: calc(100dvh - 32px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(126, 217, 154, 0.22);
          border-radius: var(--r-lg);
          background:
            linear-gradient(180deg, rgba(2, 8, 6, 0.4), rgba(2, 8, 6, 0.92)),
            radial-gradient(circle at 72% 12%, rgba(240, 165, 0, 0.14), transparent 36%),
            radial-gradient(circle at 18% 8%, rgba(46, 204, 113, 0.16), transparent 40%),
            url("/media/misty-lake.jpg");
          background-size: cover;
          background-position: center;
          color: var(--text);
          box-shadow: 0 34px 120px rgba(0, 0, 0, 0.62), var(--shadow-glow);
        }

        .weekly-mirror-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(115deg, rgba(4, 10, 8, 0.94), rgba(4, 14, 10, 0.76) 54%, rgba(4, 10, 8, 0.94)),
            repeating-radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 18px);
          opacity: 0.92;
        }

        .weekly-mirror-intro,
        .weekly-mirror-loading,
        .weekly-mirror-empty,
        .weekly-mirror-result {
          position: relative;
          z-index: 1;
        }

        .weekly-mirror-content-scroll {
          flex: 1 1 auto;
          height: 100%;
          max-height: calc(100dvh - 32px);
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .weekly-mirror-close {
          position: absolute;
          top: 18px;
          right: 18px;
          z-index: 10;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.72);
          cursor: pointer;
        }

        .weekly-mirror-intro,
        .weekly-mirror-loading,
        .weekly-mirror-empty {
          min-height: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(24px, 5vw, 48px);
          text-align: center;
        }

        .weekly-mirror-rings {
          width: 132px;
          height: 132px;
          margin-bottom: 26px;
          border-radius: 50%;
          border: 1px solid rgba(126, 217, 154, 0.26);
          background:
            repeating-radial-gradient(circle, transparent 0 15px, rgba(126, 217, 154, 0.18) 16px 17px),
            radial-gradient(circle, rgba(240, 165, 0, 0.12), transparent 62%);
          box-shadow: inset 0 0 44px rgba(46, 204, 113, 0.08), 0 0 48px rgba(46, 204, 113, 0.12);
        }

        .weekly-mirror-kicker {
          margin: 0 0 12px;
          color: rgba(126, 217, 154, 0.78);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.6px;
          text-transform: uppercase;
        }

        .weekly-mirror-intro h2,
        .weekly-mirror-loading h2,
        .weekly-mirror-empty h2,
        .weekly-mirror-result h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(32px, 7vw, 54px);
          font-weight: 500;
          line-height: 1.05;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .weekly-mirror-intro h2 span {
          display: block;
          margin-top: 6px;
          color: rgba(232, 232, 227, 0.74);
          font-size: clamp(24px, 5vw, 38px);
        }

        .weekly-mirror-primary,
        .weekly-mirror-secondary {
          margin-top: 28px;
          border-radius: 999px;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
          padding: 13px 22px;
          max-width: 100%;
        }

        .weekly-mirror-primary {
          border: 1px solid rgba(46, 204, 113, 0.38);
          background: linear-gradient(135deg, var(--green), var(--green-bright));
          color: #03110b;
          box-shadow: 0 14px 34px rgba(46, 204, 113, 0.18);
        }

        .weekly-mirror-secondary {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(232, 232, 227, 0.78);
        }

        .weekly-mirror-loader {
          width: 72px;
          height: 72px;
          margin-bottom: 26px;
          border-radius: 50%;
          border: 1px solid rgba(126, 217, 154, 0.22);
          border-top-color: rgba(126, 217, 154, 0.82);
          animation: weeklyMirrorSpin 1.6s linear infinite;
          box-shadow: 0 0 32px rgba(46, 204, 113, 0.12);
        }

        .weekly-mirror-loading p,
        .weekly-mirror-empty p {
          max-width: 520px;
          margin: 18px 0 0;
          color: rgba(232, 232, 227, 0.64);
          font-size: 15px;
          line-height: 1.7;
        }

        .weekly-mirror-soft-card {
          width: min(420px, 100%);
          margin-top: 24px;
          padding: 18px;
          border: 1px solid rgba(126, 217, 154, 0.2);
          border-radius: var(--r-md);
          background: rgba(6, 17, 13, 0.72);
          color: rgba(232, 232, 227, 0.78);
          line-height: 1.6;
        }

        .weekly-mirror-result {
          padding: clamp(22px, 4vw, 34px);
        }

        .weekly-mirror-result-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-right: 42px;
          margin-bottom: 18px;
        }

        .weekly-mirror-status {
          flex: 0 0 auto;
          border: 1px solid rgba(240, 165, 0, 0.26);
          border-radius: 999px;
          background: rgba(240, 165, 0, 0.08);
          color: rgba(255, 214, 143, 0.82);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          padding: 7px 10px;
          text-transform: uppercase;
        }

        .weekly-mirror-hero-card,
        .weekly-mirror-section-card,
        .weekly-mirror-recommendation-card,
        .weekly-mirror-focus-card {
          border: 1px solid rgba(126, 217, 154, 0.16);
          border-radius: var(--r-md);
          background: linear-gradient(145deg, rgba(7, 18, 14, 0.82), rgba(2, 8, 6, 0.68));
          box-shadow: 0 18px 52px rgba(0, 0, 0, 0.26);
          backdrop-filter: blur(18px);
        }

        .weekly-mirror-hero-card {
          padding: clamp(20px, 4vw, 28px);
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(24px, 5vw, 36px);
          line-height: 1.18;
        }

        .weekly-mirror-section-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .weekly-mirror-section-card {
          padding: 18px;
        }

        .weekly-mirror-section-card h3 {
          margin: 0 0 9px;
          color: rgba(126, 217, 154, 0.74);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
          line-height: 1.35;
          text-transform: uppercase;
        }

        .weekly-mirror-section-card p,
        .weekly-mirror-recommendation-card p,
        .weekly-mirror-focus-card p {
          margin: 0;
          color: rgba(232, 232, 227, 0.68);
          font-size: 14px;
          line-height: 1.65;
          overflow-wrap: break-word;
        }

        .weekly-mirror-recommendation-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
          margin-top: 12px;
          padding: 20px;
          background:
            radial-gradient(circle at 12% 20%, rgba(126, 217, 154, 0.14), transparent 34%),
            linear-gradient(145deg, rgba(6, 31, 21, 0.9), rgba(3, 10, 7, 0.74));
        }

        .weekly-mirror-recommendation-card h3 {
          margin: 0 0 8px;
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(22px, 4vw, 31px);
          font-weight: 500;
          line-height: 1.12;
          overflow-wrap: anywhere;
        }

        .weekly-mirror-recommendation-button {
          border: 1px solid rgba(240, 165, 0, 0.32);
          border-radius: 999px;
          background: rgba(240, 165, 0, 0.13);
          color: rgba(255, 223, 166, 0.94);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 800;
          line-height: 1.2;
          padding: 12px 16px;
          white-space: nowrap;
        }

        .weekly-mirror-focus-card {
          margin-top: 12px;
          padding: 22px;
          background:
            radial-gradient(circle at 88% 20%, rgba(240, 165, 0, 0.12), transparent 36%),
            linear-gradient(145deg, rgba(14, 43, 28, 0.88), rgba(3, 10, 7, 0.72));
        }

        .weekly-mirror-focus-card h3 {
          margin: 0 0 10px;
          font-family: var(--font-display);
          font-size: clamp(26px, 5vw, 38px);
          font-weight: 500;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        @keyframes weeklyMirrorSpin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .weekly-mirror-loader {
            animation: none;
          }
        }

        @media (max-width: 1023px) {
          .weekly-mirror-overlay {
            left: 64px;
          }
        }

        @media (max-width: 767px) {
          .weekly-mirror-overlay {
            left: 0;
            padding: 10px;
            align-items: center;
          }

          .weekly-mirror-shell {
            max-width: calc(100vw - 20px);
            max-height: calc(100vh - 20px);
            max-height: calc(100dvh - 20px);
            border-radius: 18px;
          }

          .weekly-mirror-content-scroll {
            max-height: calc(100dvh - 20px);
          }

          .weekly-mirror-result-header {
            flex-direction: column;
            padding-right: 42px;
          }

          .weekly-mirror-section-list {
            grid-template-columns: 1fr;
          }

          .weekly-mirror-recommendation-card {
            grid-template-columns: 1fr;
          }

          .weekly-mirror-recommendation-button {
            width: 100%;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
