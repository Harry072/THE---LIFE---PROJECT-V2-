import { useGrowthTree } from "../hooks/useGrowthTree";
import { useTreeSeason } from "../hooks/useTreeSeason";
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

// Philosophical context — quiet lines, never pressure, never judgment.
function completionContext(rate) {
  if (rate <= 30) return "Start where you are.";
  if (rate <= 60) return "Showing up is more than most.";
  if (rate <= 85) return "Consistent. That is rare.";
  return "This is what discipline looks like.";
}

function streakContext(days) {
  if (days <= 0) return "Every tree starts from one day.";
  if (days <= 3) return "The first days are the hardest ones.";
  if (days <= 7) return "A week of showing up.";
  if (days <= 14) return "The habit is forming.";
  if (days <= 29) return "This is becoming who you are.";
  return "Thirty days. The roots are real.";
}

function reflectionsContext(count) {
  if (count <= 0) return "The journal is waiting for you.";
  if (count <= 3) return "You are starting to listen.";
  if (count <= 7) return "Patterns are forming.";
  if (count <= 14) return "You know yourself better than most.";
  return "You have built a mirror for your life.";
}

export default function TreeStatCards() {
  const {
    score,
    completionRate,
    streak,
    reflectionsDone,
    stage,
  } = useGrowthTree();
  const { season } = useTreeSeason();

  // Real count from the reflections table via the season payload — the
  // legacy user_behavior.total_reflections column is never written.
  const reflectionsCount = season?.stats?.reflections_count ?? reflectionsDone;

  const values = {
    lifeScore: `${score} pts`,
    completion: `${completionRate}%`,
    streak: `${streak} days`,
    reflections: reflectionsCount,
  };

  const contexts = {
    lifeScore: stage?.name || "",
    completion: completionContext(completionRate),
    streak: streakContext(streak),
    reflections: reflectionsContext(reflectionsCount),
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
          {contexts[stat.key] ? (
            <p style={{
              margin: "8px 0 0",
              fontSize: 11,
              color: "var(--text-faint)",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              letterSpacing: 0.2,
              lineHeight: 1.5,
            }}>
              {contexts[stat.key]}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
