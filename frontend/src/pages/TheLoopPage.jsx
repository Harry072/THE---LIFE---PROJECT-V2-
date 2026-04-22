import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLoopTasks } from "../hooks/useLoopTasks";
import LoopTaskCard from "../components/loop/LoopTaskCard";
import LoopDetailPanel from "../components/loop/LoopDetailPanel";

export default function TheLoopPage() {
  const navigate = useNavigate();
  // Destructure correctly: hook returns { tasks: { tasks, insight }, loading, ... }
  const { data: loopData, loading, error, generating, refresh, toggleTask, clearError } = useLoopTasks();
  
  const tasks = loopData?.tasks || [];
  const dailyInsight = loopData?.insight || "Your path is unfolding as it should.";
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 6000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Sort: uncompleted first, then completed
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return 0; // maintain original order
  });

  const activeTask = tasks.find(t => t.id === activeId) || sorted[0] || null;

  const handleRefresh = async () => {
    try {
      await refresh();
    } catch (err) {
      // Error managed by hook
    }
  };

  return (
    <div className="the-loop-page" style={{
      minHeight: "100vh",
      width: "100%",
      padding: "40px 20px",
      background: "var(--bg-main, #0A0F0D)", // Fallback to deep dark if variable missing
      color: "var(--text, #FFFFFF)",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      overflowX: "hidden"
    }}>
      <div style={{ 
        maxWidth: 1200, 
        margin: "0 auto", 
        width: "100%", 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        minHeight: 0 // Crucial for inner scroll
      }}>

        {/* Header with Daily Insight */}
        <header style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontFamily: "var(--font-display, serif)",
              fontWeight: 800,
              margin: 0,
              letterSpacing: -1,
              color: "var(--text)"
            }}>
              Today's <span style={{ color: "var(--green-bright, #2ECC71)" }}>Loop</span>
            </h1>
            <button
              onClick={() => navigate("/dashboard")}
              style={{ 
                background: "rgba(255,255,255,0.05)", 
                border: "1px solid rgba(255,255,255,0.1)", 
                color: "var(--text-dim, #AAA)", 
                padding: "8px 16px",
                borderRadius: 20,
                cursor: "pointer", 
                fontSize: 12,
                transition: "all 0.2s"
              }}
            >
              ← Dashboard
            </button>
          </div>

          <div className="insight-card" style={{
            padding: "20px 24px",
            borderRadius: 20,
            background: "rgba(46, 204, 113, 0.03)",
            borderLeft: "4px solid var(--green-bright, #2ECC71)",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.2)"
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: 16, 
              color: "var(--text-dim)", 
              fontStyle: "italic", 
              lineHeight: 1.6,
              opacity: 0.9
            }}>
              "{dailyInsight}"
            </p>
          </div>
        </header>

        {error && (
          <div style={{
            marginBottom: 24,
            padding: "14px 20px",
            borderRadius: 14,
            background: "rgba(231, 76, 60, 0.1)",
            border: "1px solid rgba(231, 76, 60, 0.2)",
            color: "#e74c3c",
            fontSize: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{error}</span>
            <button onClick={clearError} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 5 }}>✕</button>
          </div>
        )}

        {/* Main Content Layout */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 420px", 
          gap: 40, 
          flex: 1, 
          minHeight: 0 
        }}>
          
          {/* Left Column: Tasks */}
          <div style={{ 
            overflowY: "auto", 
            paddingRight: 10, 
            display: "flex", 
            flexDirection: "column", 
            gap: 20,
            scrollbarWidth: "none" // Hide scrollbar for cleaner cinematic look
          }}>
            {generating || loading ? (
              <div style={{
                height: 400,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 28,
                padding: 48,
                textAlign: "center",
                color: "var(--text-dim)",
                border: "1px solid rgba(255,255,255,0.05)"
              }}>
                <div className="spinner" style={{ 
                  width: 40, height: 40, 
                  border: "3px solid rgba(46, 204, 113, 0.1)", 
                  borderTopColor: "var(--green-bright)", 
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginBottom: 20
                }}></div>
                <p style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>Curating your daily path...</p>
              </div>
            ) : sorted.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sorted.map((task) => (
                  <LoopTaskCard
                    key={task.id}
                    task={task}
                    isActive={activeId === task.id || (!activeId && task.id === sorted[0]?.id)}
                    onHover={() => setActiveId(task.id)}
                    onToggle={toggleTask}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: 80, 
                color: 'var(--text-faint)',
                background: "rgba(255,255,255,0.01)",
                borderRadius: 28,
                border: "1px dashed rgba(255,255,255,0.05)"
              }}>
                <p style={{ fontSize: 16, marginBottom: 24 }}>No tasks found for today.</p>
                <button 
                  onClick={handleRefresh} 
                  style={{ 
                    padding: "12px 32px", 
                    borderRadius: 12, 
                    background: "var(--green-bright)", 
                    border: "none", 
                    color: "black", 
                    fontWeight: 600, 
                    cursor: "pointer" 
                  }}
                >
                  Generate Loop
                </button>
              </div>
            )}

            {/* Regeneration Action Area */}
            <div style={{
              marginTop: 20,
              padding: "32px",
              borderRadius: 24,
              border: "1px dashed var(--border, rgba(255,255,255,0.1))",
              textAlign: "center",
              background: "rgba(0,0,0,0.1)"
            }}>
              <p style={{ margin: "0 0 20px", color: "var(--text-dim)", fontSize: 14 }}>
                Not feeling these? You can recalibrate your daily tasks.
              </p>
              <button
                onClick={handleRefresh}
                disabled={generating}
                style={{
                  padding: "12px 28px",
                  borderRadius: 14,
                  background: "var(--bg-card, rgba(255,255,255,0.05))",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 14,
                  cursor: generating ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s",
                  opacity: generating ? 0.6 : 1
                }}
              >
                {generating ? "Calibrating..." : "Regenerate Daily Tasks"}
              </button>
            </div>
          </div>

          {/* Right Column: Detail Panel */}
          <div style={{ 
            height: "100%", 
            position: "sticky",
            top: 0,
            borderRadius: 28,
            overflow: "hidden",
            background: "var(--bg-card, #0D1310)",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
          }}>
            <LoopDetailPanel task={activeTask} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .the-loop-page * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
