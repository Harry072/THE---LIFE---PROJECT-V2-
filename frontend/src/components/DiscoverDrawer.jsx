import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { DISCOVER_FEATURES } from "../data/lifeNavigation";

/**
 * Full-screen drawer behind the Discover tab — how the user finds what
 * they need without being shown everything at once. Parent-controlled
 * mount; closes on ×, backdrop, or Escape.
 */
export default function DiscoverDrawer({ onClose }) {
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const openFeature = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="discover-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Discover more features"
    >
      <button
        type="button"
        className="discover-drawer-backdrop"
        aria-label="Close discover"
        onClick={onClose}
      />

      <div className="discover-drawer-content">
        <header className="discover-drawer-header">
          <p>Discover</p>
          <button
            ref={closeButtonRef}
            type="button"
            className="discover-drawer-close"
            aria-label="Close discover"
            onClick={onClose}
          >
            <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
        </header>

        <div className="discover-drawer-grid">
          {DISCOVER_FEATURES.map((feature) => (
            <div
              key={feature.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${feature.label}`}
              className="discover-drawer-card"
              onClick={() => openFeature(feature.path)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFeature(feature.path);
                }
              }}
            >
              <Icon name={feature.icon} size={26} color="var(--green-bright)" />
              <p className="discover-drawer-card-label">{feature.label}</p>
              <p className="discover-drawer-card-purpose">{feature.purpose}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .discover-drawer {
          position: fixed;
          inset: 0;
          z-index: 130;
          display: flex;
          align-items: stretch;
          justify-content: center;
          animation: fadeIn 0.3s ease-in-out both;
        }

        .discover-drawer-backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(4, 8, 6, 0.96);
          backdrop-filter: blur(14px);
          cursor: default;
        }

        .discover-drawer-content {
          position: relative;
          width: min(760px, 100%);
          padding: 28px 20px calc(28px + env(safe-area-inset-bottom));
          overflow-y: auto;
        }

        .discover-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .discover-drawer-header p {
          margin: 0;
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
        }

        .discover-drawer-close {
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

        .discover-drawer-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        @media (min-width: 768px) {
          .discover-drawer-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .discover-drawer-card {
          min-height: 132px;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--bg-card);
          cursor: pointer;
          transition: transform 0.2s ease-in-out, border-color 0.2s ease-in-out;
        }

        .discover-drawer-card:hover,
        .discover-drawer-card:focus-visible {
          transform: translateY(-2px);
          border-color: var(--border-strong);
          outline: none;
        }

        .discover-drawer-card-label {
          margin: 0;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 500;
        }

        .discover-drawer-card-purpose {
          margin: 0;
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (prefers-reduced-motion: reduce) {
          .discover-drawer {
            animation: none;
          }
          .discover-drawer-card {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
