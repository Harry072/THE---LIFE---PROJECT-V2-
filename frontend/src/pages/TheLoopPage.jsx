import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoopTasks } from "../hooks/useLoopTasks";
import { useAppState } from "../contexts/AppStateContext";
import LoopTaskCard from "../components/loop/LoopTaskCard";
import LoopDetailPanel from "../components/loop/LoopDetailPanel";
import LoopIntroVideo from "../components/loop/LoopIntroVideo";
import LoopNotificationToast from "../components/loop/LoopNotificationToast";

const LOOP_INTRO_VIDEO_STORAGE_KEY = "lifeProject.loopIntroVideoSeen";

const LOOP_TOAST_MESSAGES = {
  waiting: "Your daily practices are waiting. Start with the smallest one.",
  taskComplete: "One practice completed. Your tree gained vitality.",
  allComplete: "Today's Loop is complete. Small actions become identity.",
  streak: "Your streak continues. Consistency is becoming part of you.",
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getInitialIntroVideoVisibility = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LOOP_INTRO_VIDEO_STORAGE_KEY) !== "true";
};

export default function TheLoopPage() {
  const navigate = useNavigate();
  // useLoopTasks reads the current user from AppStateContext,
  // including onboarding_answers and user_tree.streak for personalized generation.
  // Destructure correctly: hook returns { tasks: { tasks, insight }, loading, ... }
  const { data: loopData, loading, error, generating, refresh, toggleTask, clearError } = useLoopTasks();
  const { user, user_tree } = useAppState();
  
  const tasks = useMemo(() => loopData?.tasks || [], [loopData?.tasks]);
  const dailyInsight = loopData?.insight || "Your path is unfolding as it should.";
  const [activeId, setActiveId] = useState(null);
  const [showLoopIntroVideo, setShowLoopIntroVideo] = useState(getInitialIntroVideoVisibility);
  const [isLoopIntroReplay, setIsLoopIntroReplay] = useState(false);
  const [currentToast, setCurrentToast] = useState(null);
  const waitingToastShownRef = useRef(false);
  const currentToastRef = useRef(null);
  const toastQueueRef = useRef([]);
  const completedToday = tasks.filter(task => task.done).length;
  const streakDisplay = user_tree?.streak ?? "-";
  const lifeScoreDisplay = user_tree?.cumulative_score ?? "-";
  const momentumCards = [
    { label: "Day Streak", value: streakDisplay },
    { label: "Life Score", value: lifeScoreDisplay },
    { label: "Completed Today", value: completedToday },
  ];

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 6000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const showNextToast = useCallback(() => {
    if (currentToastRef.current || toastQueueRef.current.length === 0) return;

    const [nextToast, ...remainingToasts] = toastQueueRef.current;
    toastQueueRef.current = remainingToasts;
    currentToastRef.current = nextToast;
    setCurrentToast(nextToast);
  }, []);

  const enqueueToast = useCallback((key, message) => {
    if (!key || !message) return;

    const duplicatePending = toastQueueRef.current.some((toast) => toast.key === key);
    if (duplicatePending || currentToastRef.current?.key === key) return;

    const nextToast = { key, message };
    if (!currentToastRef.current) {
      currentToastRef.current = nextToast;
      setCurrentToast(nextToast);
      return;
    }

    toastQueueRef.current = [...toastQueueRef.current, nextToast];
  }, []);

  useEffect(() => {
    if (
      waitingToastShownRef.current ||
      loading ||
      generating ||
      showLoopIntroVideo ||
      tasks.length === 0 ||
      !tasks.some((task) => !task.done)
    ) {
      return;
    }

    waitingToastShownRef.current = true;
    const timer = window.setTimeout(() => {
      enqueueToast("daily-practices-waiting", LOOP_TOAST_MESSAGES.waiting);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enqueueToast, generating, loading, showLoopIntroVideo, tasks]);

  const closeCurrentToast = useCallback(() => {
    currentToastRef.current = null;
    setCurrentToast(null);
    window.setTimeout(showNextToast, 0);
  }, [showNextToast]);

  const dismissLoopIntroVideo = useCallback(() => {
    if (!isLoopIntroReplay) {
      window.localStorage.setItem(LOOP_INTRO_VIDEO_STORAGE_KEY, "true");
    }
    setShowLoopIntroVideo(false);
    setIsLoopIntroReplay(false);
  }, [isLoopIntroReplay]);

  const replayLoopIntroVideo = useCallback(() => {
    setIsLoopIntroReplay(true);
    setShowLoopIntroVideo(true);
  }, []);

  const handleTaskToggle = useCallback(async (taskId, updatedTask) => {
    const streakBeforeCompletion = toFiniteNumber(user_tree?.streak);
    const result = await toggleTask(taskId, updatedTask);
    const completionPayload = result?.completionPayload;
    const metrics = completionPayload?.metrics;

    if (!updatedTask && metrics) {
      const awardedPoints = toFiniteNumber(metrics.awardedPoints);

      if (awardedPoints > 0) {
        if (metrics.allTasksComplete) {
          enqueueToast(
            `all-complete-${taskId}`,
            LOOP_TOAST_MESSAGES.allComplete
          );
        } else {
          enqueueToast(
            `task-complete-${taskId}`,
            LOOP_TOAST_MESSAGES.taskComplete
          );
        }

        const newStreak = toFiniteNumber(metrics.streak);
        if (streakBeforeCompletion > 0 && newStreak > streakBeforeCompletion) {
          enqueueToast(`streak-${newStreak}`, LOOP_TOAST_MESSAGES.streak);
        }
      }
    }

    return result;
  }, [enqueueToast, toggleTask, user_tree?.streak]);

  // Sort: uncompleted first, then completed
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return 0; // maintain original order
  });

  const activeTask = tasks.find(t => t.id === activeId) || sorted[0] || null;

  const handleRefresh = async () => {
    if (!user?.id) return;

    try {
      await refresh();
    } catch {
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

          <button
            type="button"
            onClick={replayLoopIntroVideo}
            style={{
              margin: "-10px 0 18px",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "rgba(126,217,154,0.82)",
              fontSize: 13,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Why The Loop Works
          </button>

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

          <div className="loop-momentum-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
            marginTop: 18,
          }}>
            {momentumCards.map((card) => (
              <div
                key={card.label}
                style={{
                  padding: "16px 18px",
                  borderRadius: 18,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                }}>
                  {card.label}
                </p>
                <p style={{
                  margin: "8px 0 0",
                  fontSize: 26,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: "var(--text)",
                  lineHeight: 1,
                }}>
                  {card.value}
                </p>
              </div>
            ))}
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
        <div className="loop-main-layout" style={{ 
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
                    onToggle={handleTaskToggle}
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
        @media (max-width: 900px) {
          .the-loop-page .loop-main-layout {
            grid-template-columns: 1fr !important;
          }
          .the-loop-page .loop-momentum-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <LoopIntroVideo
        isOpen={showLoopIntroVideo}
        onDismiss={dismissLoopIntroVideo}
      />
      <LoopNotificationToast
        isVisible={Boolean(currentToast)}
        message={currentToast?.message}
        onClose={closeCurrentToast}
      />
    </div>
  );
}
