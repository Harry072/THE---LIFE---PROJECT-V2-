import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoopTasks } from "../hooks/useLoopTasks";
import LoopTaskRow from "../components/loop/LoopTaskRow";
import LoopDetailPanel from "../components/loop/LoopDetailPanel";
import Icon from "../components/Icon";
 
export default function TheLoopPage() {
  const navigate = useNavigate();
  const { tasks, loading, generating, toggleTask, refresh } = useLoopTasks();
  const [activeId, setActiveId] = useState(null);
 
  // Sort: uncompleted first, then completed
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.sort_order - b.sort_order;
  });

  const activeTask = tasks.find(t => t.id === activeId) || sorted[0] || null;
  const allDone = tasks.length > 0 && tasks.every(t => t.done);
 
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-main)",
      color: "var(--text)",
      padding: "32px 24px",
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
      }}>
        {/* Master-detail container */}
        <div className="loop-container" style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 0,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          overflow: "hidden",
          minHeight: 600,
          boxShadow: "var(--shadow-lift)",
        }}>
          {/* LEFT: Task list */}
          <div style={{ borderRight: "1px solid var(--border)" }}>
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "24px 24px 16px",
            }}>
              <h2 style={{
                margin: 0, fontSize: 11, fontWeight: 500,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: "var(--text-faint)",
              }}>
                Today's Plan
              </h2>
              <button
                onClick={() => navigate("/loop/all")}
                style={{
                  background: "none", border: "none",
                  color: "var(--green-bright)",
                  fontSize: 13, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                View All Tasks &rarr;
              </button>
            </div>
 
            {/* Task rows */}
            <div style={{ paddingBottom: 20 }}>
              {loading || generating ? (
                <div style={{
                  padding: 48, textAlign: "center",
                  color: "var(--text-dim)",
                }}>
                  <div className="spinning" style={{ marginBottom: 16 }}>
                    <Icon name="loop" size={32} color="var(--green-bright)" />
                  </div>
                  <p style={{
                    fontStyle: "italic",
                    fontFamily: "var(--font-display)",
                    fontSize: 16,
                  }}>
                    {generating ? "Weaving your path..." : "Loading tasks..."}
                  </p>
                </div>
              ) : (
                sorted.map(task => (
                  <LoopTaskRow
                    key={task.id}
                    task={task}
                    isActive={activeTask?.id === task.id}
                    onHover={() => setActiveId(task.id)}
                    onToggle={() => toggleTask(task.id)}
                  />
                ))
              )}
            </div>
            
            {/* Refresh Button - Footer of Left Panel */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "center"
            }}>
              <button 
                onClick={refresh}
                disabled={generating}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-faint)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Icon name="loop" size={14} className={generating ? "spinning" : ""} />
                Regenerate Daily Tasks
              </button>
            </div>
          </div>
 
          {/* RIGHT: Detail panel */}
          <div className="detail-panel-desktop" style={{ height: "100%" }}>
            <LoopDetailPanel task={activeTask} allDone={allDone} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .loop-container {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
          .detail-panel-desktop {
            display: none !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

