import Icon from "../Icon";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../store/userStore";
import { useGrowthTree } from "../../hooks/useGrowthTree";
import { FEATURE_PURPOSE, NAV_GROUPS } from "../../data/lifeNavigation";
import {
  getPreferredAvatarUrl,
  getPreferredInitial,
  getPreferredUsername,
} from "../../utils/userDisplayName";

function NavItem({ item, active, onClick }) {
  return (
    <button
      className="sidebar-nav-btn"
      onClick={onClick}
      title={FEATURE_PURPOSE[item.id] || item.label}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "18px minmax(0, 1fr)",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "9px 14px",
        background: active ? "rgba(46,204,113,0.08)" : "transparent",
        border: "none",
        borderRadius: "var(--r-sm)",
        color: active ? "var(--text)" : "var(--text-dim)",
        fontSize: 14,
        fontFamily: "var(--font-body)",
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        textAlign: "left",
        transition: "color 0.2s ease, background 0.2s ease",
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.color = "var(--text-dim)";
      }}
    >
      {active && (
        <span style={{
          position: "absolute", left: -8, top: "50%",
          transform: "translateY(-50%)",
          width: 3, height: 22,
          background: "var(--green-bright)",
          borderRadius: 2,
          boxShadow: "0 0 8px var(--green-glow)",
        }} />
      )}
      <Icon
        name={item.icon}
        size={18}
        color={active ? "var(--green-bright)" : "currentColor"}
      />
      <span style={{
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {item.label}
      </span>
    </button>
  );
}

function SidebarProgressMini({ onClick }) {
  const { score, progress, stage, tasks } = useGrowthTree();
  return (
    <div
      data-widget
      onClick={onClick}
      style={{
        margin: "6px 0 2px",
        padding: "10px 12px",
        background: "rgba(8,14,10,0.65)",
        border: "1px solid rgba(46,204,113,0.12)",
        borderRadius: 12,
        cursor: "pointer",
        flexShrink: 0,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(46,204,113,0.22)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(46,204,113,0.12)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="var(--green-bright)" strokeWidth="1.5" strokeLinecap="round"
          style={{ flexShrink: 0 }}>
          <path d="M12 22V12" />
          <path d="M12 12c-3-1-5-3-5-6 0-2.2 2-4 5-4s5 1.8 5 4c0 3-2 5-5 6z" />
        </svg>
        <span style={{
          fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-body)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {stage?.name || "Seedling"}
        </span>
        <span style={{
          fontSize: 11, color: "var(--green-bright)", fontFamily: "var(--font-body)",
          fontWeight: 600, whiteSpace: "nowrap",
        }}>
          {score}pts
        </span>
      </div>
      <div style={{
        height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.07)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          borderRadius: 2,
          background: "linear-gradient(90deg, var(--green), var(--green-bright))",
          transition: "width 0.8s ease",
        }} />
      </div>
      <div style={{
        marginTop: 5, fontSize: 10,
        color: "var(--text-faint)", fontFamily: "var(--font-body)",
        textAlign: "right",
      }}>
        {tasks.done}/{tasks.total} tasks
      </div>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;
  const user = useUserStore(state => state.user);
  const profile = useUserStore(state => state.profile);
  const displayName = getPreferredUsername(user, profile);
  const initials = getPreferredInitial(user, profile);
  const avatarUrl = getPreferredAvatarUrl(user);

  return (
    <>
      <aside className="app-sidebar">
        {/* Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "0 8px 22px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24"
            fill="none" stroke="var(--green-bright)"
            strokeWidth="1.2" strokeLinecap="round"
            style={{ flexShrink: 0 }}>
            <path d="M12 22V12" />
            <path d="M12 12c-3-1-5-3-5-6 0-2 2-4 5-4s5 2 5 4c0 3-2 5-5 6z" />
            <path d="M12 12c-2-.5-4-2-5-4M12 12c2-.5 4-2 5-4" />
          </svg>
          <div className="sidebar-logo-text" style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
            <span style={{ color: "var(--text)" }}>The </span>
            <span style={{ color: "var(--green-bright)", fontStyle: "italic" }}>Life</span>
            <span style={{ color: "var(--text)" }}> Project</span>
          </div>
        </div>

        {/* Nav — scrollable if content overflows */}
        <nav style={{
          display: "flex", flexDirection: "column",
          gap: 10, flex: 1,
          overflowY: "auto", overflowX: "hidden",
          paddingRight: 2, minHeight: 0,
        }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              <p className="sidebar-group-label" style={{
                margin: "0 0 1px", padding: "0 14px",
                color: "var(--text-faint)", fontSize: 10,
                fontWeight: 700, letterSpacing: 1.8,
                textTransform: "uppercase", fontFamily: "var(--font-body)",
              }}>
                {group.label}
              </p>
              {group.items.map(item => {
                const active = item.activeHash
                  ? activePath === "/dashboard" && location.hash === item.activeHash
                  : (activePath === item.path && !location.hash)
                    || (item.path !== "/dashboard" && activePath.startsWith(item.path));

                return (
                  <NavItem
                    key={item.id}
                    item={item}
                    active={active}
                    onClick={() => navigate(item.path)}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        {/* Progress mini widget — hides on tablet */}
        <SidebarProgressMini onClick={() => navigate("/progress")} />

        {/* Footer */}
        <div style={{
          display: "flex", flexDirection: "column",
          gap: 2, paddingTop: 10, flexShrink: 0,
          borderTop: "1px solid var(--border)",
        }}>
          <NavItem
            item={{ id: "settings", label: "Settings", icon: "settings", path: "/profile" }}
            active={activePath === "/profile"}
            onClick={() => navigate("/profile")}
          />
          <button
            className="sidebar-profile-btn"
            onClick={() => navigate("/profile")}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "8px 12px", marginTop: 2,
              background: "transparent", border: "none",
              borderRadius: "var(--r-sm)",
              cursor: "pointer", textAlign: "left",
              transition: "background 0.2s",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--green), #1a2a1a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "var(--text)",
              fontFamily: "var(--font-display)", fontWeight: 600,
              position: "relative", overflow: "hidden", flexShrink: 0,
            }}>
              {initials}
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="User profile photo"
                  onError={e => { e.currentTarget.style.display = "none"; }}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%", objectFit: "cover",
                  }}
                />
              )}
            </div>
            <div data-profile-text>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                {displayName}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-faint)" }}>
                View Profile
              </p>
            </div>
          </button>
        </div>
      </aside>

      <style>{`
        .app-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 240px;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 24px 16px 16px;
          z-index: 50;
          overflow: hidden;
        }

        /* Tablet: icon-only at 64px */
        @media (max-width: 1023px) {
          .app-sidebar {
            width: 64px !important;
            padding: 20px 8px 14px !important;
          }
          .app-sidebar .sidebar-logo-text,
          .app-sidebar .sidebar-group-label,
          .app-sidebar [data-widget],
          .app-sidebar [data-profile-text] {
            display: none !important;
          }
          .app-sidebar .sidebar-nav-btn {
            grid-template-columns: 18px !important;
            justify-content: center !important;
            gap: 0 !important;
            padding: 10px 0 !important;
          }
          .app-sidebar .sidebar-nav-btn > span {
            display: none !important;
          }
          .app-sidebar .sidebar-profile-btn {
            justify-content: center !important;
            padding: 8px 0 !important;
          }
        }

        /* Mobile: sidebar hidden — bottom nav takes over */
        @media (max-width: 767px) {
          .app-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
