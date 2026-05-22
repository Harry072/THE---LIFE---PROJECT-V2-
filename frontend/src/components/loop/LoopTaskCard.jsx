import { useEffect, useMemo, useState } from "react";
import Icon from "../Icon";

const DIFFICULTY_LABELS = {
  gentle: "Gentle",
  normal: "Steady",
  deeper: "Deeper",
};

const sentenceBeforeAction = (value = "") => (
  String(value).split(/\bAction:\s*/i)[0]?.trim() || ""
);

const actionAfterMarker = (value = "") => (
  String(value).split(/\bAction:\s*/i)[1]?.trim() || ""
);

function DetailRow({ icon, label, children }) {
  return (
    <div className="loop-task-detail-row">
      <div className="loop-task-detail-icon" aria-hidden="true">
        <Icon name={icon} size={18} strokeWidth={1.8} />
      </div>
      <p className="loop-task-detail-label">{label}</p>
      <p className="loop-task-detail-value">{children}</p>
    </div>
  );
}

export default function LoopTaskCard({ task, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(Boolean(task.done ?? task.completed_at));
  const [hasBegun, setHasBegun] = useState(false);

  useEffect(() => {
    const nextDoneState = Boolean(task.done ?? task.completed_at);
    setIsDone(nextDoneState);
    if (nextDoneState) setIsSubmitting(false);
  }, [task.completed_at, task.done]);

  const display = useMemo(() => {
    const detailText = task.detail_description || "";
    const whyText = (
      task.ikigai_purpose ||
      task.why_this_helps ||
      task.why ||
      sentenceBeforeAction(detailText) ||
      "This step matters because it turns intention into one visible action."
    );
    const actionText = (
      task.waar_action ||
      actionAfterMarker(detailText) ||
      task.success_condition ||
      "Complete the stated action once."
    );

    return {
      title: task.title || "Complete one honest step",
      kotlerTag: task.kotler_tag || "Clear Waar",
      duration: task.duration_minutes || task.estimated_duration_mins || 15,
      difficulty: DIFFICULTY_LABELS[task.difficulty_level] || task.difficulty_level || "Steady",
      whyText,
      actionText,
      smallerVersion: task.smaller_version || task.easier_version || "Do the smallest honest version for 2 minutes.",
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

  const handleBegin = () => {
    setHasBegun(true);
  };

  return (
    <article
      className={[
        "loop-funnel-task",
        expanded ? "is-expanded" : "",
        isDone ? "is-complete" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="loop-task-topline">
        <button
          type="button"
          className="loop-task-check"
          onClick={handleComplete}
          disabled={isSubmitting || isDone}
          aria-label={isDone ? "Task completed" : "Mark task complete"}
        >
          {isDone ? <Icon name="check" size={18} strokeWidth={2.6} /> : null}
        </button>

        <button
          type="button"
          className="loop-task-summary"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className="loop-task-title-row">
            <span className="loop-task-title">{display.title}</span>
            <Icon
              name="arrow"
              size={20}
              strokeWidth={1.7}
              className="loop-task-chevron"
              style={{ transform: expanded ? "rotate(-90deg)" : "rotate(90deg)" }}
            />
          </span>

          <span className="loop-task-meta-row">
            <span className="loop-task-kotler">
              <span aria-hidden="true" />
              {display.kotlerTag}
            </span>
            <span className="loop-task-meta-dot" aria-hidden="true" />
            <span>{display.duration} min</span>
            <span className="loop-task-difficulty">{display.difficulty}</span>
          </span>
        </button>
      </div>

      {expanded && (
        <div className="loop-task-expanded">
          <DetailRow icon="leaf" label="Why this matters">
            {display.whyText}
          </DetailRow>
          <DetailRow icon="check" label="Done when">
            {display.actionText}
          </DetailRow>
          <DetailRow icon="sprout" label="Smaller version">
            {display.smallerVersion}
          </DetailRow>

          {!isDone && (
            <button type="button" className="loop-task-primary" onClick={handleBegin}>
              {hasBegun ? "Continue task" : "Begin this step"}
              <Icon name="arrow" size={20} strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
