import Icon from "../Icon";
import { useNavigate } from "react-router-dom";

const WEEK_DATA = [
  { day: "Mon", value: 40 },
  { day: "Tue", value: 55 },
  { day: "Wed", value: 48 },
  { day: "Thu", value: 70 },
  { day: "Fri", value: 62 },
  { day: "Sat", value: 80 },
  { day: "Sun", value: 75 },
];

const STATS = [
  { icon: "check",    label: "Tasks Done",    value: "18" },
  { icon: "pulse",    label: "Hours Focused", value: "4.5" },
  { icon: "meditate", label: "Meditations",   value: "3" },
  { icon: "books",    label: "Books Explored",value: "2" },
];

export default function GrowthChart() {
  const navigate = useNavigate();
  const max = Math.max(...WEEK_DATA.map(d => d.value));
  const w = 200, h = 80;
  const points = WEEK_DATA.map((d, i) => {
    const x = (i / (WEEK_DATA.length - 1)) * w;
    const y = h - (d.value / max) * (h - 10);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div
      onClick={() => navigate("/progress")}
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "20px 22px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20, alignItems: "center",
        cursor: "pointer",
      }}
    >
      <div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <h3 style={{
            margin: 0, fontSize: 11, fontWeight: 500,
            letterSpacing: 2.5, textTransform: "uppercase",
            color: "var(--text-faint)",
          }}>
            Your Growth
          </h3>
          <span style={{ fontSize: 11,
            color: "var(--text-dim)" }}>
            This Week &darr;
          </span>
        </div>

        <svg width={w} height={h + 20}
          style={{ display: "block" }}>
          <defs>
            <linearGradient id="gg" x1="0" y1="0"
              x2="0" y2="1">
              <stop offset="0%"
                stopColor="var(--green-bright)"
                stopOpacity="0.4" />
              <stop offset="100%"
                stopColor="var(--green-bright)"
                stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline
            points={points}
            fill="none"
            stroke="var(--green-bright)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon
            points={`${points} ${w},${h} 0,${h}`}
            fill="url(#gg)"
          />
          {WEEK_DATA.map((d, i) => {
            const x = (i / (WEEK_DATA.length - 1)) * w;
            const y = h - (d.value / max) * (h - 10);
            return (
              <circle key={i} cx={x} cy={y} r="3"
                fill="var(--green-bright)" />
            );
          })}
        </svg>

        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 10, color: "var(--text-faint)",
          marginTop: 4,
        }}>
          {WEEK_DATA.map(d => (
            <span key={d.day}>{d.day}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex",
        flexDirection: "column", gap: 10 }}>
        {STATS.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Icon name={s.icon} size={16}
              color="var(--green-bright)" />
            <span style={{ flex: 1, fontSize: 13,
              color: "var(--text)" }}>
              <strong>{s.value}</strong> {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
