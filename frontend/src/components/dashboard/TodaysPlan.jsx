import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useLoopTasks } from "../../hooks/useLoopTasks";
import { useEnsureTodayLoopTasks } from "../../hooks/useEnsureTodayLoopTasks";
import { useAppState } from "../../contexts/AppStateContext";
import PostActionFeedbackModal from "../loop/PostActionFeedbackModal";
import PatternRevealModal from "./PatternRevealModal";
import { usePatternReveal } from "../../hooks/usePatternReveal";

const CAT_COLORS = {
  awareness: "#4ECDC4", action: "#FF8C42", reflection: "#7FD99A", reset: "#C084FC", growth: "#FFD93D",
  meaning: "#FFD93D",
};

const DIFFICULTY_LABELS = {
  gentle: "Tiny", normal: "Easy", deeper: "Moderate",
};

const DIFFICULTY_COLORS = {
  gentle: "#7FD99A", normal: "#FFD93D", deeper: "#FF8C42",
};

function ErrorMessage({ message, onDismiss, onRetry }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={{
      padding: "10px 14px",
      marginBottom: 12,
      borderRadius: "var(--r-sm)",
      background: "rgba(239, 68, 68, 0.1)",
      border: "1px solid rgba(239, 68, 68, 0.2)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "fadeIn 0.3s ease-out",
    }}>
      <Icon name="alert" size={14} color="#ef4444" />
      <p style={{
        flex: 1,
        margin: 0,
        fontSize: 13,
        color: "#f87171",
        fontFamily: "var(--font-body)",
        lineHeight: 1.4,
      }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "none",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 6,
            color: "#f87171",
            fontSize: 12,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

function EmptyState({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "32px 20px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(8px)",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
      }}
    >
      <p style={{
        margin: 0,
        fontStyle: "italic",
        fontFamily: "var(--font-display)",
        fontSize: 16,
        color: "var(--text-dim)",
        lineHeight: 1.5,
      }}>
        No tasks yet for today. Take a breath — your next step is being prepared.
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
        Your plan will appear here when you&rsquo;re ready &rarr;
      </p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px",
      borderRadius: "var(--r-sm)",
    }}>
      <div className="skeleton-shimmer" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton-shimmer" style={{ height: 14, borderRadius: 6, width: "60%", marginBottom: 6 }} />
        <div className="skeleton-shimmer" style={{ height: 11, borderRadius: 5, width: "35%" }} />
      </div>
      <div className="skeleton-shimmer" style={{ height: 20, width: 44, borderRadius: 6 }} />
    </div>
  );
}

function DayProgressMeter({ done, total }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {done} of {total} today
        </span>
        {done === total && total > 0 && (
          <span style={{ fontSize: 11, color: "var(--green-bright)", fontWeight: 600 }}>
            All done ✓
          </span>
        )}
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: done === total && total > 0
            ? "var(--green-bright)"
            : "linear-gradient(90deg, rgba(46,204,113,0.6), var(--green-bright))",
          borderRadius: 4,
          transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onOpen }) {
  const done = task.done;
  const catColor = CAT_COLORS[task.category] || "var(--green-bright)";
  const diffLabel = DIFFICULTY_LABELS[task.difficulty_level] || "";
  const diffColor = DIFFICULTY_COLORS[task.difficulty_level] || "var(--text-faint)";

  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "13px 16px",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-row-hover, rgba(255,255,255,0.03))"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
        style={{
          width: 22, height: 22, borderRadius: "50%",
          flexShrink: 0,
          border: `2px solid ${done ? catColor : "var(--border-strong)"}`,
          background: done ? catColor : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          cursor: "pointer",
        }}
      >
        {done && <Icon name="check" size={11} color="white" strokeWidth={3} />}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 500,
          color: done ? "var(--text-faint)" : "var(--text)",
          textDecoration: done ? "line-through" : "none",
          transition: "all 0.2s",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {task.title}
        </p>
        {/* Category dot + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: catColor }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: catColor, flexShrink: 0 }} />
            {task.category
              ? task.category.charAt(0).toUpperCase() + task.category.slice(1)
              : ""}
          </span>
          {(task.duration_minutes || task.estimated_duration_mins) && (
            <>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>·</span>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                ~{task.duration_minutes || task.estimated_duration_mins} min
              </span>
            </>
          )}
        </div>
      </div>

      {/* Difficulty pill */}
      {diffLabel && !done && (
        <span style={{
          fontSize: 10, padding: "3px 7px", borderRadius: 6,
          background: `${diffColor}1A`,
          color: diffColor,
          letterSpacing: 0.4,
          fontWeight: 600, flexShrink: 0,
          border: `1px solid ${diffColor}28`,
        }}>
          {diffLabel}
        </span>
      )}
    </div>
  );
}

export default function TodaysPlan() {
  const navigate = useNavigate();
  const { user } = useAppState();
  const {
    tasks,
    toggleTask,
    loading,
    hasFetched,
    error,
    clearError,
    generating,
    generateTasks,
    retryWithSafeFallback,
    saveTaskFeedback,
  } = useLoopTasks();
  const [feedbackTask, setFeedbackTask] = useState(null);
  const [isFeedbackSkip, setIsFeedbackSkip] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const {
    pending: patternRevealPending,
    description: patternRevealDescription,
    question: patternRevealQuestion,
    checkForReveal,
    markSeen: markPatternRevealSeen,
    dismissForToday: dismissPatternRevealForToday,
  } = usePatternReveal();
  const [showPatternRevealModal, setShowPatternRevealModal] = useState(false);
  const {
    autoGenerationError,
    clearAutoGenerationError,
    preparingTodayPlan,
  } = useEnsureTodayLoopTasks({
    user,
    tasks,
    hasFetched,
    loading,
    error,
    generating,
    generateTasks,
  });

  const CORE_CATS = ["awareness", "action", "reflection", "reset", "growth"];
  const coreTasks = (tasks || []).filter(t => CORE_CATS.includes(t.category));
  const displayed = coreTasks.filter(t => !t.skipped).slice(0, 4);
  const doneCount = displayed.filter(t => t.done).length;
  const totalCount = coreTasks.length;
  const allTasksDone = coreTasks.length > 0
    && coreTasks.every(t => t.done || t.completed_at || t.skipped);
  const statusMessage = error || autoGenerationError;
  const isPreparingPlan = preparingTodayPlan || (generating && displayed.length === 0);

  useEffect(() => {
    if (allTasksDone) {
      checkForReveal();
    }
  }, [allTasksDone, checkForReveal]);

  const handleShowPatternReveal = useCallback(() => {
    setShowPatternRevealModal(true);
  }, []);

  const handleClosePatternReveal = useCallback(() => {
    setShowPatternRevealModal(false);
    markPatternRevealSeen();
  }, [markPatternRevealSeen]);

  const handleTaskToggle = useCallback(async (taskId) => {
    const result = await toggleTask(taskId);
    const completedTask = result?.completionPayload?.task;
    if (completedTask) {
      setIsFeedbackSkip(false);
      setFeedbackTask(completedTask);
      setFeedbackError("");
    }
    return result;
  }, [toggleTask]);

  const handleSubmitFeedback = useCallback(async (feedback) => {
    if (!feedbackTask?.id) return;
    setFeedbackSaving(true);
    setFeedbackError("");
    try {
      await saveTaskFeedback(feedbackTask.id, feedback);
      setFeedbackTask(null);
    } catch (requestError) {
      setFeedbackError(requestError?.message || "Could not save this signal yet.");
    } finally {
      setFeedbackSaving(false);
    }
  }, [feedbackTask?.id, saveTaskFeedback]);

  const handleCloseFeedback = useCallback(() => {
    setFeedbackTask(null);
    setFeedbackError("");
    setIsFeedbackSkip(false);
  }, []);

  return (
    <>
      <div style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "24px",
        minHeight: 280,
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

        {/* Day progress meter */}
        {totalCount > 0 && !isPreparingPlan && !loading && (
          <DayProgressMeter done={doneCount} total={totalCount} />
        )}

        {/* Task list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {statusMessage && (
            <ErrorMessage
              message={statusMessage}
              onDismiss={() => {
                clearError();
                clearAutoGenerationError();
              }}
              onRetry={() => {
                clearError();
                clearAutoGenerationError();
                generateTasks(retryWithSafeFallback
                  ? { allow_safe_fallback: true }
                  : {});
              }}
            />
          )}

          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : isPreparingPlan ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)" }}>
              Finding the next honest action.
            </div>
          ) : displayed.length > 0 ? (
            <>
              {displayed.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={handleTaskToggle}
                  onOpen={() => navigate("/loop")}
                />
              ))}
              {allTasksDone && (
                <div style={{
                  marginTop: 10,
                  padding: "13px 18px",
                  borderRadius: 10,
                  background: "rgba(46,204,113,0.05)",
                  border: "1px solid rgba(46,204,113,0.13)",
                  textAlign: "center",
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--green-bright)", fontWeight: 500 }}>
                    Today&apos;s loop is complete. Small actions become identity.
                  </p>
                </div>
              )}
              {allTasksDone && patternRevealPending && (
                <div style={{
                  marginTop: 10,
                  padding: "13px 18px",
                  borderRadius: 10,
                  background: "rgba(126,217,154,0.05)",
                  border: "1px solid rgba(126,217,154,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
                    I&rsquo;ve noticed something about you. Want to see it?
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={dismissPatternRevealForToday}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "transparent",
                        color: "var(--text-faint)",
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                      }}
                    >
                      Later
                    </button>
                    <button
                      type="button"
                      onClick={handleShowPatternReveal}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "1px solid rgba(126, 217, 154, 0.32)",
                        background: "var(--green-bright)",
                        color: "#06100b",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                      }}
                    >
                      Show me
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState onClick={() => navigate("/loop")} />
          )}
        </div>
      </div>

      {feedbackTask ? (
        <PostActionFeedbackModal
          task={feedbackTask}
          isSkip={isFeedbackSkip}
          isSaving={feedbackSaving}
          error={feedbackError}
          onSubmit={handleSubmitFeedback}
          onClose={handleCloseFeedback}
        />
      ) : null}

      {showPatternRevealModal ? (
        <PatternRevealModal
          description={patternRevealDescription}
          question={patternRevealQuestion}
          onClose={handleClosePatternReveal}
        />
      ) : null}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.04) 100%
          );
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>
    </>
  );
}
