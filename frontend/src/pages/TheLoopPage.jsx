import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLoopTasks } from "../hooks/useLoopTasks";
import { useAppState } from "../contexts/AppStateContext";
import { useGrowthTree } from "../hooks/useGrowthTree";
import LoopTaskCard from "../components/loop/LoopTaskCard";
import LoopIntroVideo from "../components/loop/LoopIntroVideo";
import LoopNotificationToast from "../components/loop/LoopNotificationToast";
import PostActionFeedbackModal from "../components/loop/PostActionFeedbackModal";
import { useContextualGreeting } from "../hooks/useContextualGreeting";
import Icon from "../components/Icon";

const LOOP_TOAST_MESSAGES = {
  waiting: "Your daily practices are waiting. Start with the smallest one.",
  taskComplete: "Step completed. The next honest action is still here.",
  allComplete: "Today's Loop is complete. Come back tomorrow.",
};

const CORE_CATS = ["awareness", "action", "meaning"];
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

  const tasks = useMemo(() => loopData?.tasks || [], [loopData?.tasks]);
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

  const coreSorted = sorted.filter((task) => CORE_CATS.includes(task.category));
  const hasAllCoreCategories = CORE_CATS.every((category) => (
    coreSorted.some((task) => task.category === category)
  ));
  const allDone = coreSorted.length > 0
    && hasAllCoreCategories
    && sorted.every((task) => task.done || task.skipped);
  const signalLine = (whisper || DEFAULT_SIGNAL).trim();

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

  const handleSkipTask = useCallback((taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.done || task.skipped) return;
    setFeedbackIsSkip(true);
    setFeedbackTask(task);
    setFeedbackError("");
  }, [tasks]);

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

  const isBusy = loading || generating;

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

        {isBusy ? (
          <div className="loop-funnel-loading" role="status">
            <span aria-hidden="true" />
            <p>Preparing the next clear step.</p>
          </div>
        ) : sorted.length > 0 ? (
          <div className="loop-funnel-list" aria-label="Today's Loop tasks">
            {sorted.map((task) => (
              <LoopTaskCard
                key={task.id}
                task={task}
                onToggle={handleTaskToggle}
                onSkip={handleSkipTask}
              />
            ))}
          </div>
        ) : hasFetched ? (
          <div className="loop-funnel-empty">
            <p>No tasks are prepared yet.</p>
            <button type="button" onClick={handlePrepareLoop}>
              Prepare Today&apos;s Loop
            </button>
          </div>
        ) : null}

        {allDone && (
          <div className="loop-funnel-complete" role="status">
            <Icon name="leaf" size={18} />
            <p>Progress is built in tiny, honest steps.</p>
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
    </main>
  );
}
