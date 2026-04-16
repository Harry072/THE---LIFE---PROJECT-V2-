import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../contexts/AppStateContext";

function StatCard({ iconName, iconColor, glowColor,
  value, label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "18px 22px",
        background: "var(--bg-card)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        transition: "border-color 0.3s",
        cursor: "pointer",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor
        = "var(--border-strong)"}
      onMouseLeave={e => e.currentTarget.style.borderColor
        = "var(--border)"}
    >
      <div style={{
        width: 42, height: 42, borderRadius: "50%",
        background: `${glowColor}22`,
        display: "flex", alignItems: "center",
        justifyContent: "center",
        boxShadow: `inset 0 0 12px ${glowColor}44`,
      }}>
        <Icon name={iconName} size={20} color={iconColor} />
      </div>
      <div>
        <p style={{
          margin: 0, fontSize: 28, fontWeight: 600,
          color: "var(--text)", lineHeight: 1,
          fontFamily: "var(--font-body)",
        }}>
          {value}
        </p>
        <p style={{
          margin: "4px 0 0", fontSize: 12,
          color: "var(--text-faint)",
          fontFamily: "var(--font-body)",
        }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export default function StatCards() {
  const navigate = useNavigate();
  const { stats } = useAppState();

  const cards = [
    { iconName: "leaf", iconColor: "#7fd99a",
      glowColor: "#2ECC71",
      value: stats.streak, label: "Day Streak",
      onClick: () => navigate("/progress#streak"),
    },
    { iconName: "flame", iconColor: "#ff9a4d",
      glowColor: "#F0A500",
      value: stats.lifeScore, label: "Life Score",
      onClick: () => navigate("/progress#score"),
    },
    { iconName: "pulse", iconColor: "#4da8ff",
      glowColor: "#4A9FFF",
      value: stats.tasksCompleted, label: "Tasks Completed",
      onClick: () => navigate("/progress#tasks"),
    },
  ];
  return (
    <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16,
      marginBottom: 32,
    }}>
      {cards.map((s, i) => <StatCard key={i} {...s} />)}
    </section>
  );
}
