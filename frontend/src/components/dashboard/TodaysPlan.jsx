import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../contexts/AppStateContext";

function EmptyState({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 24,
        textAlign: "center",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        color: "var(--text-dim)",
      }}
    >
      <p style={{ margin: 0, fontStyle: "italic",
        fontFamily: "var(--font-display)", fontSize: 16 }}>
        Your day is a blank page.
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 13 }}>
        Tap here to plan it in The Loop &rarr;
      </p>
    </div>
  );
}

function TaskRow({ task, onToggle, onOpen }) {
  const done = task.completed_at != null;
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "14px 18px",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        transition: "background 0.2s",
      }}
      onMouseEnter={e => e.currentTarget.style.background
        = "var(--bg-row-hover)"}
      onMouseLeave={e => e.currentTarget.style.background
        = "transparent"}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
        style={{
          width: 22, height: 22, borderRadius: "50%",
          flexShrink: 0,
          border: `2px solid ${done
            ? "var(--green-bright)"
            : "var(--border-strong)"}`,
          background: done
            ? "var(--green-bright)" : "transparent",
          display: "flex", alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s",
        }}
      >
        {done && (
          <Icon name="check" size={12} color="white"
            strokeWidth={3} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 500,
          color: done ? "var(--text-dim)" : "var(--text)",
          textDecoration: done ? "line-through" : "none",
          transition: "all 0.3s",
        }}>
          {task.content || task.title}
        </p>
        <p style={{
          margin: "2px 0 0", fontSize: 12,
          color: "var(--text-faint)",
        }}>
          {task.subtitle || (task.domain ? {
            awareness: "5 minutes reflection",
            action: "30 minutes",
            meaning: "Gratitude & Growth",
          }[task.domain] || task.domain : "")}
        </p>
      </div>

      {/* Domain badge */}
      <span style={{
        fontSize: 12, color: "var(--text-faint)",
        fontFamily: "var(--font-body)",
        textTransform: "capitalize",
      }}>
        {task.domain || ""}
      </span>
    </div>
  );
}

export default function TodaysPlan() {
  const navigate = useNavigate();
  const { tasks, toggleTask } = useAppState();

  // Show top 4 tasks for today on the dashboard
  const displayed = tasks.slice(0, 4);

  return (
    <div style={{
      background: "var(--bg-card)",
      backdropFilter: "blur(24px)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-md)",
      padding: "24px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      }}>
        <h3 style={{
          margin: 0, fontSize: 11, fontWeight: 500,
          letterSpacing: 2.5, textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          Today&rsquo;s Plan
        </h3>
        <button
          onClick={() => navigate("/loop")}
          style={{
            background: "none", border: "none",
            color: "var(--green-bright)",
            fontFamily: "var(--font-body)", fontSize: 12,
            cursor: "pointer", display: "flex",
            alignItems: "center", gap: 4,
          }}
        >
          View All Tasks
          <Icon name="arrow" size={12} />
        </button>
      </div>

      {/* Tasks */}
      <div style={{ display: "flex", flexDirection: "column",
        gap: 4 }}>
        {displayed.length > 0
          ? displayed.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={toggleTask}
                onOpen={() => navigate("/loop")}
              />
            ))
          : <EmptyState onClick={() => navigate("/loop")} />
        }
      </div>
    </div>
  );
}
