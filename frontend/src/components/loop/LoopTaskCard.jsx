import { useEffect, useMemo, useState } from "react";
import Icon from "../Icon";

const actionAfterMarker = (value = "") => (
  String(value).split(/\bAction:\s*/i)[1]?.trim() || ""
);

// Static local paths only — all four confirmed present in
// public/media/dashboard/ before wiring this map in. "reset" has no
// approved image; those cards render with no background rather than a
// substituted one.
const FEATURE_IMAGES = {
  action: "/media/dashboard/focus_mountain_landscape.png",
  awareness: "/media/dashboard/companion_forest_leaves.png",
  reflection: "/media/dashboard/reflection_journal_desk.png",
  growth: "/media/dashboard/growth_tree_morning_mist.png",
};

function handleBgImageError(category) {
  return (event) => {
    console.warn(`LoopTaskCard: background image failed to load for category "${category}"`);
    event.currentTarget.style.display = "none";
  };
}

export default function LoopTaskCard({ task, onToggle }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(Boolean(task.done ?? task.completed_at));

  useEffect(() => {
    const nextDoneState = Boolean(task.done ?? task.completed_at);
    setIsDone(nextDoneState);
    if (nextDoneState) setIsSubmitting(false);
  }, [task.completed_at, task.done]);

  const display = useMemo(() => {
    const detailText = task.detail_description || "";
    const description = (
      task.waar_action ||
      actionAfterMarker(detailText) ||
      task.success_condition ||
      "Complete the stated action once."
    );

    return {
      title: task.title || "Complete one honest step",
      kotlerTag: task.kotler_tag || "Clear Waar",
      description,
    };
  }, [task]);

  const handleComplete = async () => {
    if (isSubmitting || isDone || !task.id) return;

    setIsSubmitting(true);
    setIsDone(true);

    try {
      await onToggle?.(task.id);
    } catch (err) {
      console.error("Interaction failed:", err);
      setIsDone(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bgSrc = FEATURE_IMAGES[task.category];

  return (
    <article
      className={`loop-funnel-task${isDone ? " is-complete" : ""}`}
      aria-label={`${display.title}: ${display.description}`}
    >
      {bgSrc && (
        <>
          <img
            className="loop-task-bg"
            src={bgSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={handleBgImageError(task.category)}
          />
          <span className="loop-task-bg-gradient" aria-hidden="true" />
        </>
      )}

      <div className="loop-task-content">
        <span className="loop-task-kotler">{display.kotlerTag}</span>
        <h2 className="loop-task-title">{display.title}</h2>
        <p className="loop-task-description">{display.description}</p>

        {isDone ? (
          <span className="loop-task-done-badge" aria-label="Task completed">
            <Icon name="check" size={18} strokeWidth={2.6} />
          </span>
        ) : (
          <button
            type="button"
            className="loop-task-mark-done"
            onClick={handleComplete}
            disabled={isSubmitting}
          >
            Mark as done
            <Icon name="check" size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </article>
  );
}
