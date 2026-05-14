import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import { GUIDE_ME_OPTIONS } from "../../data/lifeNavigation";

export default function GuideMeModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSelect = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="guide-me-backdrop" onClick={onClose}>
      <section
        className="guide-me-modal"
        aria-modal="true"
        role="dialog"
        aria-labelledby="guide-me-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-me-header">
          <div>
            <p>Guide Me</p>
            <h2 id="guide-me-title">What do you need right now?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Guide Me">
            Close
          </button>
        </div>

        <div className="guide-me-options">
          {GUIDE_ME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.path)}
            >
              <span>
                <Icon name={option.icon} size={18} />
              </span>
              <strong>{option.label}</strong>
              <Icon name="arrow" size={15} />
            </button>
          ))}
        </div>
      </section>

      <style>{`
        .guide-me-backdrop {
          position: fixed;
          inset: 0;
          z-index: 140;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(1, 6, 4, 0.68);
          backdrop-filter: blur(14px);
          animation: fadeIn 0.18s ease both;
        }

        .guide-me-modal {
          width: min(620px, 100%);
          max-height: min(760px, calc(100vh - 48px));
          overflow: auto;
          border: 1px solid rgba(126, 217, 154, 0.22);
          border-radius: var(--r-lg);
          background:
            radial-gradient(circle at 84% 6%, rgba(46, 204, 113, 0.12), transparent 38%),
            linear-gradient(145deg, rgba(16, 26, 20, 0.96), rgba(5, 10, 8, 0.96));
          box-shadow: var(--shadow-lift), var(--shadow-glow);
          padding: 24px;
        }

        .guide-me-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .guide-me-header p {
          margin: 0 0 8px;
          color: rgba(126, 217, 154, 0.76);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .guide-me-header h2 {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(30px, 7vw, 42px);
          font-weight: 500;
          line-height: 1.05;
          letter-spacing: 0;
        }

        .guide-me-header > button {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-dim);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 12px;
          padding: 9px 13px;
        }

        .guide-me-options {
          display: grid;
          gap: 10px;
        }

        .guide-me-options button {
          min-height: 56px;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 18px;
          align-items: center;
          gap: 12px;
          width: 100%;
          border: 1px solid rgba(126, 217, 154, 0.13);
          border-radius: var(--r-sm);
          background: rgba(255, 255, 255, 0.032);
          color: var(--text);
          cursor: pointer;
          font-family: var(--font-body);
          padding: 10px 12px;
          text-align: left;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .guide-me-options button:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
          background: rgba(46, 204, 113, 0.06);
        }

        .guide-me-options button span {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(46, 204, 113, 0.18);
          border-radius: 50%;
          color: var(--green-bright);
          background: rgba(46, 204, 113, 0.055);
        }

        .guide-me-options button strong {
          min-width: 0;
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.35;
        }

        @media (max-width: 767px) {
          .guide-me-backdrop {
            align-items: flex-end;
            padding: 12px;
          }

          .guide-me-modal {
            max-height: calc(100vh - 24px);
            border-radius: var(--r-lg) var(--r-lg) 18px 18px;
            padding: 20px;
          }

          .guide-me-header {
            flex-direction: column;
          }

          .guide-me-header > button {
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
}
