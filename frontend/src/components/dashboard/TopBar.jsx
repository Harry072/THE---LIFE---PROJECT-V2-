import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../store/userStore";
import { getPreferredAvatarUrl } from "../../utils/userDisplayName";

// Search, "Go Premium", and the notification bell were removed here
// (2026-08-25 audit): the search input had no handler and no ⌘K listener
// existed anywhere in the app; "Go Premium" pointed at a query param
// (?tab=premium) that ProfilePage never read, and no billing/subscription
// flow exists anywhere in the codebase; the bell's onClick was a no-op.
// All three were decorative dead weight. The profile icon is untouched —
// it is the sole route to /profile, which is the sole signOut surface in
// the app (ProfilePage.jsx's handleSignOut) — removing it would strip the
// user's only way to sign out.
export default function TopBar() {
  const navigate = useNavigate();
  const user = useUserStore(state => state.user);
  const avatarUrl = getPreferredAvatarUrl(user);

  return (
    <header style={{
      display: "flex", alignItems: "center",
      justifyContent: "flex-end",
      padding: "20px 32px",
    }}>
      <IconButton
        iconName="user"
        avatarUrl={avatarUrl}
        ariaLabel="Open profile"
        onClick={() => navigate("/profile")}
      />
    </header>
  );
}

function IconButton({ iconName, onClick, avatarUrl = "", ariaLabel }) {
  return (
    <button
      aria-label={ariaLabel || iconName}
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        color: "var(--text-dim)", cursor: "pointer",
        display: "flex", alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = "var(--text)";
        e.currentTarget.style.borderColor
          = "var(--border-strong)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = "var(--text-dim)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <Icon name={iconName} size={18} />
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
    </button>
  );
}
