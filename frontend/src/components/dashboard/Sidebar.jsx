import Icon from "../Icon";
import GrowthTree from "../GrowthTree";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../store/userStore";
import { FEATURE_PURPOSE, NAV_GROUPS } from "../../data/lifeNavigation";
import {
  getPreferredAvatarUrl,
  getPreferredInitial,
  getPreferredUsername,
} from "../../utils/userDisplayName";

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={FEATURE_PURPOSE[item.id]}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "18px minmax(0, 1fr)",
        alignItems: "center",
        gap: 12,
        width: "100%", padding: "10px 14px",
        background: active ? "rgba(46,204,113,0.08)" : "transparent",
        border: "none", borderRadius: "var(--r-sm)",
        color: active ? "var(--text)" : "var(--text-dim)",
        fontSize: 14, fontFamily: "var(--font-body)",
        fontWeight: active ? 500 : 400,
        cursor: "pointer", textAlign: "left",
        transition: "all 0.3s ease",
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
          width: 3, height: 24,
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
      }}>{item.label}</span>
    </button>
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
    <aside style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: 240,
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "24px 16px 16px",
      zIndex: 50,
    }}>
      {/* Logo — navigates to dashboard */}
      <div
        onClick={() => navigate("/dashboard")}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 8px 28px",
          cursor: "pointer",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24"
          fill="none" stroke="var(--green-bright)"
          strokeWidth="1.2" strokeLinecap="round">
          <path d="M12 22V12" />
          <path d="M12 12c-3-1-5-3-5-6 0-2 2-4 5-4s5 2 5 4c0 3-2 5-5 6z" />
          <path d="M12 12c-2-.5-4-2-5-4M12 12c2-.5 4-2 5-4" />
        </svg>
        <div className="sidebar-logo-text" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
          <span style={{ color: "var(--text)" }}>The </span>
          <span style={{ color: "var(--green-bright)",
            fontStyle: "italic" }}>Life</span>
          <span style={{ color: "var(--text)" }}> Project</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column",
        gap: 14, flex: 1, overflowY: "auto", paddingRight: 2 }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}>
            <p className="sidebar-group-label" style={{
              margin: "0 0 2px",
              padding: "0 14px",
              color: "var(--text-faint)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.8,
              textTransform: "uppercase",
              fontFamily: "var(--font-body)",
            }}>
              {group.label}
            </p>
            {group.items.map(item => {
              const active = item.activeHash
                ? activePath === "/dashboard" && location.hash === item.activeHash
                : activePath === item.path && !location.hash
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

      {/* Growing Widget — compact tree */}
      <div
        data-widget
        onClick={() => navigate("/progress")}
        style={{
          margin: "16px 0",
          cursor: "pointer",
          borderRadius: "var(--r-md)",
          overflow: "hidden",
        }}
      >
        <GrowthTree compact />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column",
        gap: 4, paddingTop: 12,
        borderTop: "1px solid var(--border)" }}>
        <NavItem
          item={{ id: "settings", label: "Settings",
            icon: "settings", path: "/profile" }}
          active={activePath === "/profile"}
          onClick={() => navigate("/profile")}
        />
        <button
          onClick={() => navigate("/profile")}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%", padding: "10px 12px", marginTop: 4,
            background: "transparent", border: "none",
            borderRadius: "var(--r-sm)",
            cursor: "pointer", textAlign: "left",
            transition: "background 0.2s",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, "
              + "var(--green), #1a2a1a)",
            display: "flex", alignItems: "center",
            justifyContent: "center",
            fontSize: 14, color: "var(--text)",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            position: "relative",
            overflow: "hidden",
          }}>
            {initials}
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="User profile photo"
                onError={e => {
                  e.currentTarget.style.display = "none";
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </div>
          <div data-profile-text>
            <p style={{ margin: 0, fontSize: 13,
              color: "var(--text)", fontWeight: 500 }}>
              {displayName}
            </p>
            <p style={{ margin: 0, fontSize: 11,
              color: "var(--text-faint)" }}>
              View Profile
            </p>
          </div>
        </button>
      </div>
    </aside>
    <style>{`
      @media (max-width: 1023px) {
        aside nav button {
          grid-template-columns: 18px !important;
          justify-content: center !important;
          gap: 0 !important;
          padding: 10px 0 !important;
        }

        .sidebar-group-label {
          display: none !important;
        }

        .sidebar-logo-text {
          display: none !important;
        }
      }
    `}</style>
    </>
  );
}
