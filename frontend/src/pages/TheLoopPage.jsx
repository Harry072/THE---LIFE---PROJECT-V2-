import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoopTasks } from "../hooks/useLoopTasks";
import { useAppState } from "../contexts/AppStateContext";
import { useGrowthTree } from "../hooks/useGrowthTree";
import LoopTaskCard from "../components/loop/LoopTaskCard";
import LoopIntroVideo from "../components/loop/LoopIntroVideo";
import LoopNotificationToast from "../components/loop/LoopNotificationToast";
import PostActionFeedbackModal from "../components/loop/PostActionFeedbackModal";
import PatternRevealModal from "../components/dashboard/PatternRevealModal";
import ContinuationCard from "../components/ContinuationCard";
import { usePatternReveal } from "../hooks/usePatternReveal";
import { evaluateCompletion, endChain } from "../hooks/useContinuationChain";
import { useContextualGreeting } from "../hooks/useContextualGreeting";
import { useEnsureTodayLoopTasks } from "../hooks/useEnsureTodayLoopTasks";
import Icon from "../components/Icon";

const LOOP_TOAST_MESSAGES = {
  waiting: "Your daily practices are waiting. Start with the smallest one.",
  taskComplete: "Step completed. The next honest action is still here.",
  allComplete: "Today's Loop is complete. Come back tomorrow.",
};

const CORE_CATS = ["awareness", "action", "reflection", "reset", "growth"];
const DEFAULT_SIGNAL = "One honest signal is enough for the mirror to begin forming.";
const LOOP_INTRO_STORAGE_KEY = "lifeproject_loop_intro_seen";

const shouldShowLoopIntro = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOOP_INTRO_STORAGE_KEY) !== "true";
  } catch {
    return false;
  }
};

const markLoopIntroSeen = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOOP_INTRO_STORAGE_KEY, "true");
  } catch {
    // Ignore storage failures; the overlay can still close for this session.
  }
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function TheLoopPage() {
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
  const navigate = useNavigate();
  const [chainResult, setChainResult] = useState(null);

  const tasks = useMemo(() => loopData?.tasks || [], [loopData?.tasks]);
  // Return values aren't consumed here — the empty state no longer
  // distinguishes "still preparing" from "failed to prepare" (one calm
  // message covers both) — but the hook call itself must stay: it's what
  // actually triggers auto-generation as a side effect.
  useEnsureTodayLoopTasks({
    user,
    tasks,
    hasFetched,
    loading,
    error,
    generating,
    generateTasks,
  });
  const sorted = useMemo(() => (
    [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return 0;
    })
  ), [tasks]);

  const [currentToast, setCurrentToast] = useState(null);
  const [feedbackTask, setFeedbackTask] = useState(null);
  const [feedbackIsSkip, setFeedbackIsSkip] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackMetrics, setFeedbackMetrics] = useState(null);
  const [showIntroVideo, setShowIntroVideo] = useState(shouldShowLoopIntro);
  const waitingToastShownRef = useRef(false);
  const currentToastRef = useRef(null);
  const toastQueueRef = useRef([]);

  // Fix 4 live trace found this never fired: the backend generates
  // _RETRIEVAL_TASK_COUNT (2) tasks/day spanning 2 of the 5 CORE_CATS, by
  // design (backend/main.py:2565, "always _RETRIEVAL_TASK_COUNT tasks,
  // never all of CORE_CATEGORY_ORDER") — so requiring all 5 categories
  // represented meant allDone, and therefore the continuation chain, could
  // never fire on the Loop page at all. Completeness is now "every core
  // task we actually have is done or skipped," not "all 5 categories
  // exist."
  const coreSorted = sorted.filter((task) => CORE_CATS.includes(task.category));
  const allDone = coreSorted.length > 0
    && sorted.every((task) => task.done || task.skipped);
  const signalLine = (whisper || DEFAULT_SIGNAL).trim();
  // Live count from useLoopTasks' own already-fetched, already-core-filtered
  // state — bypasses /api/dashboard's 15-minute cache entirely for stage
  // computation, rather than reading the (possibly stale) cached value.
  const tasksCompletedToday = sorted.filter((task) => task.done).length;

  // Reflection Layer 4 — the pattern reveal fires where tasks are
  // completed. "Later" stays local; /seen fires only via "Show me".
  const {
    pending: patternRevealPending,
    description: patternRevealDescription,
    question: patternRevealQuestion,
    checkForReveal,
    markSeen: markPatternRevealSeen,
    dismissForToday: dismissPatternRevealForToday,
  } = usePatternReveal();
  const [showPatternRevealModal, setShowPatternRevealModal] = useState(false);

  useEffect(() => {
    if (!allDone) return undefined;
    let cancelled = false;
    // Tracks whether this effect's own async flow already decided
    // loop_done's fate (fired normally, because the pattern wasn't
    // pending). If the user leaves the page while still deferring to a
    // pattern reveal they never engaged — no "Show me", no "Later", just
    // navigating away — this stays false, and the cleanup below resolves
    // it as a fallback. That's the third exit path (walking away is the
    // most common one), alongside the "Later" button and viewing the
    // reveal, both of which already resolve it themselves.
    let resolved = false;

    // The Continuation Chain must defer to the pattern reveal when one is
    // pending — await checkForReveal()'s own return value directly rather
    // than the hook's `pending` state, which is still stale in this closure
    // the instant the promise resolves. This is what makes the defer
    // deterministic instead of racing the reveal's own async check.
    (async () => {
      const isPatternPending = await checkForReveal();
      if (cancelled || isPatternPending) return;
      resolved = true;
      const result = await evaluateCompletion("loop_done", undefined, tasksCompletedToday);
      if (!cancelled && result) setChainResult(result);
    })();

    return () => {
      cancelled = true;
      if (!resolved) {
        // Fire-and-forget: the page is gone, there's nowhere to show a
        // card, but 'loop' must still land in completed[] rather than
        // staying deferred forever. evaluateCompletion's own duplicate
        // suppression makes this safe even if it races a genuine
        // pattern_reveal_viewed completion from the same abandoned defer.
        evaluateCompletion("loop_done", undefined, tasksCompletedToday);
      }
    };
  }, [allDone, checkForReveal, tasksCompletedToday]);

  const handleChainAccept = useCallback(() => {
    const route = chainResult?.nextRoute;
    setChainResult(null);
    if (route) navigate(route);
  }, [chainResult, navigate]);

  const handleChainDismiss = useCallback(() => {
    endChain();
    setChainResult(null);
  }, []);

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
  }, [enqueueToast, generating, loading, tasks]);

  useEffect(() => {
    if (stageUp) {
      enqueueToast("stageUp", `Your tree reached ${stageUp.to?.name ?? "a new stage"}.`);
      dismissStageUp();
    }
  }, [stageUp, dismissStageUp, enqueueToast]);

  const closeCurrentToast = useCallback(() => {
    currentToastRef.current = null;
    setCurrentToast(null);
    window.setTimeout(showNextToast, 0);
  }, [showNextToast]);

  const handleTaskToggle = useCallback(async (taskId, updatedTask) => {
    const result = await toggleTask(taskId, updatedTask);
    const completionPayload = result?.completionPayload;
    const metrics = completionPayload?.metrics;

    if (!updatedTask && metrics) {
      const awardedPoints = toFiniteNumber(metrics.awardedPoints);

      if (awardedPoints > 0) {
        enqueueToast(
          metrics.allTasksComplete ? `all-complete-${taskId}` : `task-complete-${taskId}`,
          metrics.allTasksComplete
            ? LOOP_TOAST_MESSAGES.allComplete
            : LOOP_TOAST_MESSAGES.taskComplete
        );
      }

      setFeedbackTask(result?.task || completionPayload?.task || null);
      setFeedbackMetrics(metrics ?? null);
      setFeedbackError("");
    }

    return result;
  }, [enqueueToast, toggleTask]);

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

  const handlePrepareLoop = useCallback(async () => {
    if (!user?.id) return;
    try {
      await generateTasks({ regenerate: true, allowSafeFallback: true });
    } catch {
      // Error state is managed by useLoopTasks.
    }
  }, [generateTasks, user?.id]);

  const closeIntroVideo = useCallback(() => {
    markLoopIntroSeen();
    setShowIntroVideo(false);
  }, []);

  const replayIntroVideo = useCallback(() => {
    setShowIntroVideo(true);
  }, []);

  return (
    <main className="loop-funnel-page">
      <section className="loop-funnel-shell" aria-labelledby="todays-loop-title">
        <header className="loop-funnel-header">
          <button
            type="button"
            className="loop-intro-replay-button"
            aria-label="Watch Loop intro video"
            onClick={replayIntroVideo}
          >
            <Icon name="play" size={20} strokeWidth={1.8} />
          </button>
          <h1 id="todays-loop-title">
            Today&apos;s <span>Loop</span>
          </h1>
          <p className="loop-funnel-subtitle">Small actions. Real change.</p>
          <div className="loop-funnel-signal">
            <Icon name="sprout" size={18} strokeWidth={1.8} />
            <p>{signalLine}</p>
          </div>
        </header>

        {error && (
          <div className="loop-funnel-error" role="status">
            <p>{error}</p>
            <div>
              {retryWithSafeFallback && (
                <button type="button" onClick={handlePrepareLoop}>
                  Try again
                </button>
              )}
              <button type="button" onClick={clearError} aria-label="Dismiss error">
                <Icon name="plus" size={16} style={{ transform: "rotate(45deg)" }} />
              </button>
            </div>
          </div>
        )}

        {sorted.length > 0 ? (
          <div className="loop-funnel-list" aria-label="Today's Loop tasks">
            {sorted.map((task) => (
              <LoopTaskCard
                key={task.id}
                task={task}
                onToggle={handleTaskToggle}
              />
            ))}
          </div>
        ) : (
          <div className="loop-funnel-empty" role="status">
            <p>Your tasks for today are being prepared.</p>
            <button type="button" onClick={handlePrepareLoop}>
              Generate today&apos;s tasks →
            </button>
          </div>
        )}

        {chainResult && (
          <div style={{ marginTop: 16 }}>
            <ContinuationCard
              headline={chainResult.headline}
              question={chainResult.question}
              nextFeatureName={chainResult.nextFeatureName}
              isTerminal={chainResult.isTerminal}
              onAccept={handleChainAccept}
              onDismiss={handleChainDismiss}
            />
          </div>
        )}

        {allDone && patternRevealPending && (
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
                onClick={async () => {
                  // "Later" resolves the defer just as definitively as
                  // viewing the reveal does — without this, evaluateCompletion
                  // never fires for loop_done, and 'loop' never enters
                  // completed[] until the user happens to engage the reveal.
                  dismissPatternRevealForToday();
                  const result = await evaluateCompletion("loop_done", undefined, tasksCompletedToday);
                  if (result) setChainResult(result);
                }}
                style={{
                  padding: "10px 12px",
                  minHeight: 44,
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
                onClick={() => setShowPatternRevealModal(true)}
                style={{
                  padding: "10px 14px",
                  minHeight: 44,
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
      </section>

      <LoopNotificationToast
        isVisible={Boolean(currentToast)}
        message={currentToast?.message}
        onClose={closeCurrentToast}
      />
      <LoopIntroVideo
        isOpen={showIntroVideo}
        onDismiss={closeIntroVideo}
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
      {showPatternRevealModal ? (
        <PatternRevealModal
          description={patternRevealDescription}
          question={patternRevealQuestion}
          onClose={async () => {
            setShowPatternRevealModal(false);
            markPatternRevealSeen();
            // Always terminal (Step 5): insight after action, then stop.
            const result = await evaluateCompletion("pattern_reveal_viewed", undefined, tasksCompletedToday);
            if (result) setChainResult(result);
          }}
        />
      ) : null}
    </main>
  );
}
