import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";

// Static text only — nothing dynamic enters this modal.
const NOTE_PARAGRAPHS = [
  "I built this because I needed it myself.",
  "I did not build this system to help you manage your time. I built it because I was tired of watching a world full of people lose their minds to the noise of their own impulses.",
  "We are taught from birth to track external metrics — the balance in our treasuries, the velocity of our tasks, the titles on our papers. Yet we allow the five internal thieves to plunder our presence, fragment our focus, and turn us into slaves of cheap validation. We optimise the work but break the architect.",
  "True sovereignty does not begin when you conquer an external market or pass a worldly test. It begins the exact second you step back, activate the absolute observer within, and conquer yourself.",
  "This platform is not a dopamine machine designed to give you shortcuts or flatter your ego. It is a straight, heavy, double-edged blade. A mirror of cold steel.",
  "When you open it, it will not spoon-feed you answers. It will simply look back at you and demand a single, ruthless truth:",
  "Who are you becoming in the absolute present?",
  "May it grant you the deep, silent stillness of the saint, and the unyielding, emotionless execution of the soldier.",
];

const FADE_MS = 300;

export default function FounderNoteModal({ onClose }) {
  const [leaving, setLeaving] = useState(false);
  const closeButtonRef = useRef(null);

  const requestClose = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, FADE_MS);
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`founder-note${leaving ? " is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="A note from the founder"
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="founder-note-close"
        aria-label="Close founder note"
        onClick={requestClose}
      >
        <Icon name="plus" size={20} style={{ transform: "rotate(45deg)" }} />
      </button>

      <div className="founder-note-scroll">
        <div className="founder-note-body">
          {NOTE_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
          <p className="founder-note-signature">— Harpreet Singh</p>
        </div>
      </div>

      <style>{`
        .founder-note {
          position: fixed;
          inset: 0;
          z-index: 140;
          background: var(--bg);
          animation: fadeIn ${FADE_MS}ms ease-in-out both;
          transition: opacity ${FADE_MS}ms ease-in-out;
        }

        .founder-note.is-leaving {
          opacity: 0;
        }

        .founder-note-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-dim);
          cursor: pointer;
        }

        .founder-note-scroll {
          height: 100%;
          overflow-y: auto;
          display: flex;
          justify-content: center;
          padding: 72px 24px 48px;
        }

        .founder-note-body {
          max-width: 480px;
          margin: auto 0;
          text-align: center;
        }

        .founder-note-body p {
          margin: 0 0 18px;
          color: var(--text-dim);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.75;
        }

        .founder-note-body p:first-child {
          color: var(--text);
          font-family: var(--font-display);
          font-size: 22px;
          line-height: 1.4;
        }

        .founder-note-signature {
          margin-top: 26px !important;
          color: var(--text) !important;
          font-family: var(--font-display) !important;
          font-size: 17px !important;
          font-style: italic;
        }

        @media (prefers-reduced-motion: reduce) {
          .founder-note {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
