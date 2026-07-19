import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "../Icon";
import DiscoverDrawer from "../DiscoverDrawer";
import { PRIMARY_NAV } from "../../data/lifeNavigation";
import { useUserStore } from "../../store/userStore";
import { getPreferredInitial, getPreferredUsername, toTitleCase } from "../../utils/userDisplayName";

function isActiveRoute(item, pathname) {
  if (item.path === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === item.path || pathname.startsWith(item.path);
}

/**
 * Desktop navigation: a 60px icon-only rail. No text labels, no category
 * headers, no widgets — icons guide the curious, the Discover drawer holds
 * everything else. Hidden on mobile (bottom tab bar takes over).
 */
export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const user = useUserStore((state) => state.user);
  const profile = useUserStore((state) => state.profile);
  const initial = getPreferredInitial(user, profile);
  const name = toTitleCase(getPreferredUsername(user, profile));

  return (
    <>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <button
          type="button"
          className="rail-logo"
          onClick={() => navigate("/dashboard")}
          aria-label="The Life Project — home"
          title="The Life Project"
        >
          <svg width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="var(--green-bright)"
            strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 22V12" />
            <path d="M12 12c-3-1-5-3-5-6 0-2 2-4 5-4s5 2 5 4c0 3-2 5-5 6z" />
            <path d="M12 12c-2-.5-4-2-5-4M12 12c2-.5 4-2 5-4" />
          </svg>
        </button>

        <nav className="rail-nav">
          {PRIMARY_NAV.map((item) => {
            const active = isActiveRoute(item, location.pathname);
            return (
              <button
                key={item.id}
                type="button"
                className={`rail-btn${active ? " is-active" : ""}`}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                {active && <span className="rail-active-bar" aria-hidden="true" />}
                <Icon
                  name={item.icon}
                  size={20}
                  color={active ? "var(--green-bright)" : "currentColor"}
                />
              </button>
            );
          })}

          <button
            type="button"
            className={`rail-btn${discoverOpen ? " is-active" : ""}`}
            onClick={() => setDiscoverOpen(true)}
            aria-label="Discover"
            aria-haspopup="dialog"
            title="Discover"
          >
            <Icon name="compass" size={20} />
          </button>
        </nav>

        <div className="rail-avatar">
          <div className="rail-avatar-circle">{initial}</div>
          <p className="rail-avatar-name">{name}</p>
        </div>
      </aside>

      {discoverOpen ? (
        <DiscoverDrawer onClose={() => setDiscoverOpen(false)} />
      ) : null}

      <style>{`
        .app-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 56px;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 18px 0 16px;
          z-index: 50;
          overflow: hidden;
        }

        .rail-avatar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding-top: 10px;
          flex-shrink: 0;
        }

        .rail-avatar-circle {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(46, 204, 113, 0.15);
          border: 1px solid var(--green-bright);
          color: var(--green-bright);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
        }

        .rail-avatar-name {
          margin: 0;
          max-width: 50px;
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 10px;
          text-align: center;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rail-logo {
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: var(--r-sm);
          background: transparent;
          cursor: pointer;
          margin-bottom: 18px;
          flex-shrink: 0;
        }

        .rail-nav {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-height: 0;
        }

        .rail-btn {
          position: relative;
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--text-dim);
          cursor: pointer;
          transition: color 0.2s ease-in-out, background 0.2s ease-in-out;
          flex-shrink: 0;
        }

        .rail-btn:hover {
          color: var(--text);
        }

        .rail-btn.is-active {
          color: var(--green-bright);
          background: rgba(46, 204, 113, 0.08);
        }

        .rail-active-bar {
          position: absolute;
          left: -8px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 22px;
          background: var(--green-bright);
          border-radius: 2px;
          box-shadow: 0 0 8px var(--green-glow);
        }

        @media (max-width: 767px) {
          .app-sidebar {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rail-btn {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
