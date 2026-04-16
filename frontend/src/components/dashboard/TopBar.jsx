import Icon from "../Icon";
import { useNavigate } from "react-router-dom";

export default function TopBar() {
  const navigate = useNavigate();

  return (
    <header style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "20px 32px",
      gap: 24,
    }}>
      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 480, position: "relative",
      }}>
        <Icon name="search" size={16}
          color="var(--text-faint)"
          style={{
            position: "absolute", left: 16,
            top: "50%", transform: "translateY(-50%)",
          }}
        />
        <input
          type="text"
          placeholder="Search..."
          style={{
            width: "100%", height: 40,
            padding: "0 48px 0 42px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            fontSize: 14, outline: "none",
            transition: "border-color 0.3s",
          }}
          onFocus={e => e.target.style.borderColor
            = "var(--border-strong)"}
          onBlur={e => e.target.style.borderColor
            = "var(--border)"}
        />
        <kbd style={{
          position: "absolute", right: 12,
          top: "50%", transform: "translateY(-50%)",
          padding: "2px 6px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--text-faint)",
          fontSize: 11, fontFamily: "var(--font-body)",
        }}>⌘K</kbd>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center",
        gap: 12 }}>
        <button
          onClick={() => navigate("/profile?tab=premium")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px",
            background: "linear-gradient(135deg, "
              + "var(--green) 0%, var(--green-bright) 100%)",
            border: "none",
            borderRadius: 20,
            color: "white", fontFamily: "var(--font-body)",
            fontWeight: 500, fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 4px 16px var(--green-glow)",
            transition: "all 0.3s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow
              = "0 6px 20px var(--green-glow)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow
              = "0 4px 16px var(--green-glow)";
          }}
        >
          Go Premium
          <Icon name="sparkle" size={14} filled color="white" />
        </button>

        <IconButton iconName="bell" onClick={() => {}} />
        <IconButton iconName="user" onClick={() => navigate("/profile")} />
      </div>
    </header>
  );
}

function IconButton({ iconName, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        color: "var(--text-dim)", cursor: "pointer",
        display: "flex", alignItems: "center",
        justifyContent: "center",
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
    </button>
  );
}
