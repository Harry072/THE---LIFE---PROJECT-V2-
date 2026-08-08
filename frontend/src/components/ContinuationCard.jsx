import { useEffect, useRef } from "react";

// Render-only. The parent decides positioning, wiring, and what onAccept /
// onDismiss actually do — this component only renders what it's given and
// reports the two interactions. No position:fixed, no backdrop, no portal:
// this is an inline block the parent page places, because it appears in
// three different page layouts (Loop, Reflection, Reset Space) that a fixed
// overlay would fight rather than adapt to.

export default function ContinuationCard({
  headline,
  question,
  nextFeatureName,
  onAccept,
  onDismiss,
  isTerminal = false,
}) {
  const acceptButtonRef = useRef(null);

  useEffect(() => {
    if (!isTerminal) {
      acceptButtonRef.current?.focus();
    }
    // Terminal cases take no focus — nothing to act on, and stealing focus
    // at a session close is wrong.
  }, [isTerminal]);

  useEffect(() => {
    if (isTerminal) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Terminal cases: Escape does nothing — there is nothing to dismiss.
  }, [isTerminal, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`continuation-card ${isTerminal ? "is-terminal" : "is-offer"}`}
    >
      <p className="continuation-card-headline">{headline}</p>
      {question ? (
        <p className="continuation-card-question">{question}</p>
      ) : null}

      {!isTerminal ? (
        <div className="continuation-card-actions">
          <button
            ref={acceptButtonRef}
            type="button"
            className="continuation-card-accept"
            onClick={() => onAccept?.()}
          >
            {`Open ${nextFeatureName}`}
          </button>
          <button
            type="button"
            className="continuation-card-dismiss"
            onClick={() => onDismiss?.()}
          >
            Not now
          </button>
        </div>
      ) : null}

      <style>{`
        @keyframes continuation-card-enter {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .continuation-card {
          position: relative;
          border-radius: var(--r-md);
          background: var(--bg-card-solid);
          box-shadow: var(--shadow-soft);
          font-family: var(--font-body);
          animation: continuation-card-enter 0.4s ease-out;
        }

        .continuation-card.is-offer {
          padding: 20px 24px;
          border-left: 3px solid var(--green-bright);
        }

        .continuation-card.is-terminal {
          padding: 30px 24px;
          text-align: center;
        }

        .continuation-card-headline {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-weight: 500;
        }

        .continuation-card.is-offer .continuation-card-headline {
          font-size: clamp(20px, 2.6vw, 26px);
          line-height: 1.2;
        }

        .continuation-card.is-terminal .continuation-card-headline {
          font-size: clamp(17px, 2vw, 20px);
          line-height: 1.3;
        }

        .continuation-card-question {
          margin: 8px 0 0;
          color: var(--text-dim);
          font-size: 14px;
          line-height: 1.5;
        }

        .continuation-card.is-terminal .continuation-card-question {
          color: var(--text-faint);
        }

        .continuation-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .continuation-card-accept {
          min-height: 44px;
          min-width: 44px;
          padding: 10px 22px;
          border: 1px solid var(--border-strong);
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

        .continuation-card-accept:hover {
          transform: translateY(-1px);
        }

        .continuation-card-dismiss {
          min-height: 44px;
          min-width: 44px;
          padding: 10px 16px;
          border: none;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .continuation-card-accept:focus-visible,
        .continuation-card-dismiss:focus-visible {
          outline: 2px solid var(--green-dim);
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .continuation-card {
            animation: none;
          }

          .continuation-card-accept {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
