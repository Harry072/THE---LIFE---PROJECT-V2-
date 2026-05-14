import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoopTasks } from "../hooks/useLoopTasks";
import { useAppState } from "../contexts/AppStateContext";
import { useGrowthTree } from "../hooks/useGrowthTree";
import LoopTaskCard from "../components/loop/LoopTaskCard";
import LoopDetailPanel from "../components/loop/LoopDetailPanel";
import LoopIntroVideo from "../components/loop/LoopIntroVideo";
import LoopNotificationToast from "../components/loop/LoopNotificationToast";
import PostActionFeedbackModal from "../components/loop/PostActionFeedbackModal";
import RecalibrateBar from "../components/loop/RecalibrateBar";
import ExecutionEngineCard from "../components/loop/ExecutionEngineCard";
import { useExecutionEngine } from "../hooks/useExecutionEngine";
import { useContextualGreeting } from "../hooks/useContextualGreeting";

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

const isPlainObject = (value) => (
  Boolean(value) &&
  Object.prototype.toString.call(value) === "[object Object]" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const normalizeRefreshOptions = (value) => {
  if (typeof value === "string" && value.trim()) {
    return { recalibrateTag: value.trim(), allowSafeFallback: false };
  }

  if (!isPlainObject(value)) {
    return { recalibrateTag: null, allowSafeFallback: false };
  }

  const rawTag = value.recalibrate_tag ?? value.recalibrateTag ?? value.tag;
  return {
    recalibrateTag: typeof rawTag === "string" && rawTag.trim() ? rawTag.trim() : null,
    allowSafeFallback: Boolean(value.allowSafeFallback || value.allow_safe_fallback),
  };
};

export default function TheLoopPage() {
  const navigate = useNavigate();
  // useLoopTasks reads the current user from AppStateContext,
  // including onboarding_answers and user_tree.streak for personalized generation.
  // Destructure correctly: hook returns { tasks: { tasks, insight }, loading, ... }
  const {
    data: loopData,
    loading,
    error,
    generating,
    generateTasks,
    hasFetched,
    retryWithSafeFallback,
    toggleTask,
    saveTaskFeedback,
    clearError,
  } = useLoopTasks();
  const { user, user_tree } = useAppState();
  const { stageUp, dismissStageUp } = useGrowthTree();
  const { whisper } = useContextualGreeting(user?.id, user_tree?.streak ?? 0);

  const tasks = useMemo(() => loopData?.tasks || [], [loopData?.tasks]);
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return 0;
  });

  // Approximate total tasks ever completed: 10 base pts awarded per core task.
  // Used to place the user in their 30-day progression phase.
  const completedTasksCount = Math.floor((user_tree?.cumulative_score ?? 0) / 10);
  // Last 5 completed titles from today's loop — fed to the anti-repetition shield.
  const recentCompletedTitles = sorted
    .filter((t) => t.done && t.title)
    .slice(-5)
    .map((t) => t.title);

  const {
    action: executionAction,
    loading: executionLoading,
    error: executionError,
    dismissed: executionDismissed,
    celebrated: executionCelebrated,
    primaryPainPoint: executionPainPoint,
    handleDismiss: executionHandleDismiss,
  } = useExecutionEngine({
    enabled: !loading && !generating && hasFetched && sorted.length === 0,
    completedTasksCount,
    recentTasks: recentCompletedTitles,
  });

  const dailyInsight = whisper;
  const [activeId, setActiveId] = useState(null);
  const [showLoopIntroVideo, setShowLoopIntroVideo] = useState(getInitialIntroVideoVisibility);
  const [isLoopIntroReplay, setIsLoopIntroReplay] = useState(false);
  const [currentToast, setCurrentToast] = useState(null);
  const [feedbackTask, setFeedbackTask] = useState(null);
  const [feedbackIsSkip, setFeedbackIsSkip] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackMetrics, setFeedbackMetrics] = useState(null);
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

  useEffect(() => {
    if (stageUp) {
      enqueueToast("stageUp", `Your tree just grew — you reached ${stageUp.to?.name ?? "a new stage"}`);
      dismissStageUp();
    }
  }, [stageUp, dismissStageUp, enqueueToast]);

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
      setFeedbackTask(result?.task || completionPayload?.task || null);
      setFeedbackMetrics(metrics ?? null);
      setFeedbackError("");
    }

    return result;
  }, [enqueueToast, toggleTask, user_tree?.streak]);

  const handleSubmitFeedback = useCallback(async (feedback) => {
    if (!feedbackTask?.id) return;
    setFeedbackSaving(true);
    setFeedbackError("");
    try {
      await saveTaskFeedback(feedbackTask.id, feedback);
      setFeedbackTask(null);
      setFeedbackIsSkip(false);
      setFeedbackMetrics(null);
    } catch (requestError) {
      setFeedbackError(requestError?.message || "Could not save this signal yet.");
    } finally {
      setFeedbackSaving(false);
    }
  }, [feedbackTask?.id, saveTaskFeedback]);

  const handleSkipTask = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.done || task.skipped) return;
    setFeedbackIsSkip(true);
    setFeedbackTask(task);
    setFeedbackError("");
  }, [tasks]);

  const CORE_CATS = ["awareness", "action", "meaning"];
  const coreSorted = sorted.filter(t => CORE_CATS.includes(t.category));
  const hasAllCoreCategories = CORE_CATS.every(cat => coreSorted.some(t => t.category === cat));
  const allDone = coreSorted.length > 0
    && hasAllCoreCategories
    && sorted.every(t => t.done || t.skipped);

  const activeTask = tasks.find(t => t.id === activeId) || sorted[0] || null;

  const handleRefresh = useCallback(async (options = {}) => {
    if (!user?.id) return;
    if (sorted.some(t => t.done)) {
      enqueueToast("locked", "Completed tasks lock today's Loop. Come back tomorrow for a fresh set.");
      return;
    }

    const { recalibrateTag, allowSafeFallback } = normalizeRefreshOptions(options);

    try {
      await generateTasks({
        regenerate: true,
        recalibrate_tag: recalibrateTag ?? undefined,
        allowSafeFallback,
      });
    } catch {
      // Error managed by hook
    }
  }, [enqueueToast, generateTasks, sorted, user?.id]);

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

          <p style={{
            margin: "4px 0 14px",
            fontSize: 14,
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
            letterSpacing: 0.2,
          }}>
            Your next honest action. Built from your recent signals.
          </p>

          <button
            type="button"
            onClick={replayLoopIntroVideo}
            style={{
              margin: "0 0 18px",
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {retryWithSafeFallback && (
                <button
                  type="button"
                  onClick={() => handleRefresh({ allow_safe_fallback: true })}
                  style={{
                    background: "rgba(231, 76, 60, 0.08)",
                    border: "1px solid rgba(231, 76, 60, 0.25)",
                    color: "inherit",
                    cursor: "pointer",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  Try Again
                </button>
              )}
              <button onClick={clearError} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 5 }}>✕</button>
            </div>
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
            <RecalibrateBar
              generating={generating}
              onSelect={(tag) => handleRefresh({ recalibrate_tag: tag })}
              onRegenerate={() => handleRefresh()}
            />

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
                <p style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>Finding the next honest action.</p>
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
                    onSkip={handleSkipTask}
                  />
                ))}
              </div>
            ) : (executionLoading || executionAction) && !executionDismissed ? (
              <ExecutionEngineCard
                action={executionAction}
                loading={executionLoading}
                error={executionError}
                dismissed={executionDismissed}
                celebrated={executionCelebrated}
                painPoint={executionPainPoint}
                onDismiss={executionHandleDismiss}
                onGenerateLoop={() => handleRefresh()}
              />
            ) : (
              <div style={{
                textAlign: "center",
                padding: 80,
                color: "var(--text-faint)",
                background: "rgba(255,255,255,0.01)",
                borderRadius: 28,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
              }}>
                <p style={{ fontSize: 16, marginBottom: 24 }}>
                  No tasks yet for today. Take a breath — your next step is being prepared.
                </p>
                <button
                  onClick={() => handleRefresh()}
                  style={{
                    padding: "12px 32px",
                    borderRadius: 12,
                    background: "var(--green-bright)",
                    border: "none",
                    color: "black",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Prepare Today&apos;s Plan
                </button>
              </div>
            )}

            {/* All-done celebration */}
            {allDone && (
              <div style={{
                padding: "40px 32px",
                borderRadius: 24,
                background: "linear-gradient(135deg, rgba(46,204,113,0.06), rgba(46,204,113,0.02))",
                border: "1px solid rgba(46,204,113,0.18)",
                textAlign: "center",
                animation: "fadeInUp 0.5s ease both",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 28, fontFamily: "var(--font-display)", color: "var(--green-bright)" }}>
                  Today&apos;s loop is complete.
                </p>
                <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", lineHeight: 1.6 }}>
                  Small actions become identity. Come back tomorrow.
                </p>
              </div>
            )}

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
            <LoopDetailPanel
              task={activeTask}
              onToggle={handleTaskToggle}
              onSkip={handleSkipTask}
            />
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
      {feedbackTask ? (
        <PostActionFeedbackModal
          task={feedbackTask}
          isSkip={feedbackIsSkip}
          isSaving={feedbackSaving}
          error={feedbackError}
          awardedPoints={toFiniteNumber(feedbackMetrics?.awardedPoints)}
          newStreak={toFiniteNumber(feedbackMetrics?.streak)}
          onSubmit={handleSubmitFeedback}
          onClose={() => {
            setFeedbackTask(null);
            setFeedbackIsSkip(false);
            setFeedbackError("");
            setFeedbackMetrics(null);
          }}
        />
      ) : null}
    </div>
  );
}
