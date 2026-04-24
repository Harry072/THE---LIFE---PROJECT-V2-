import { useGrowthTree } from "../hooks/useGrowthTree";
import Icon from "./Icon";

const STATS = [
  {
    key: "lifeScore",
    label: "Life Score",
    color: "#FFD93D",
    icon: "sparkle",
  },
  {
    key: "completion",
    label: "Completion Rate",
    color: "#4DA8FF",
    icon: "progress",
  },
  {
    key: "streak",
    label: "Streak Days",
    color: "#7FD99A",
    icon: "flame",
  },
  {
    key: "reflections",
    label: "Reflections Done",
    color: "#C084FC",
    icon: "check",
  },
];

export default function TreeStatCards() {
  const {
    score,
    completionRate,
    streak,
    reflectionsDone,
  } = useGrowthTree();

  const values = {
    lifeScore: score,
    completion: `${completionRate}%`,
    streak: `${streak} days`,
    reflections: reflectionsDone,
  };

  return (
    <div
      className="tree-stat-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginTop: 24,
      }}
    >
      {STATS.map((stat) => (
        <div
          key={stat.key}
          style={{
            padding: "20px 18px",
            background: "var(--bg-card)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            textAlign: "center",
            minWidth: 0,
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `${stat.color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            color: stat.color,
          }}>
            <Icon name={stat.icon} size={18} color={stat.color} />
          </div>
          <p style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.1,
            overflowWrap: "anywhere",
          }}>
            {values[stat.key]}
          </p>
          <p style={{
            margin: "6px 0 0",
            fontSize: 11,
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}>
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
