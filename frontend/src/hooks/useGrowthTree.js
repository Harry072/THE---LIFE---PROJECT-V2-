import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../contexts/AppStateContext";

const STAGES = [
  {
    id: 1,
    name: "Seed",
    min: 0,
    max: 30,
    image: "/media/tree/stage-1-seed.png",
    message: "Every journey begins here.",
  },
  {
    id: 2,
    name: "Sprout",
    min: 31,
    max: 80,
    image: "/media/tree/stage-2-sprout.png",
    message: "Something is taking root.",
  },
  {
    id: 3,
    name: "Young Plant",
    min: 81,
    max: 180,
    image: "/media/tree/stage-3-plant.png",
    message: "You're building real strength.",
  },
  {
    id: 4,
    name: "Small Tree",
    min: 181,
    max: 350,
    image: "/media/tree/stage-4-small.png",
    message: "Your roots are deepening.",
  },
  {
    id: 5,
    name: "Growing Tree",
    min: 351,
    max: 600,
    image: "/media/tree/stage-5-growing.png",
    message: "Consistency is becoming character.",
  },
  {
    id: 6,
    name: "Mature Tree",
    min: 601,
    max: Infinity,
    image: "/media/tree/stage-6-mature.png",
    message: "You've grown into something real.",
  },
];

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getStage(score) {
  return STAGES.find(stage => score >= stage.min && score <= stage.max) || STAGES[0];
}

function getProgress(score, stage) {
  if (stage.max === Infinity) return 100;
  const range = stage.max - stage.min;
  const position = score - stage.min;
  return Math.max(0, Math.min(100, Math.round((position / range) * 100)));
}

function getVitalityMsg(vitality) {
  if (vitality >= 80) return "You're thriving.";
  if (vitality >= 50) return "Keep showing up.";
  if (vitality >= 20) return "Your tree is waiting.";
  return "Every journey has quiet days.";
}

export function useGrowthTree() {
  const {
    user,
    user_tree: userTree,
    user_behavior: userBehavior,
    stats,
    tasks,
    loadStats,
  } = useAppState();

  const previousStageId = useRef(null);
  const [stageUp, setStageUp] = useState(null);

  const tree = useMemo(() => {
    const score = Math.max(0, toFiniteNumber(
      userTree?.cumulative_score ?? stats?.lifeScore,
      0
    ));
    const vitality = Math.max(0, Math.min(100, toFiniteNumber(
      userTree?.vitality ?? stats?.vitality,
      50
    )));
    const streak = Math.max(0, toFiniteNumber(
      userTree?.streak ?? userBehavior?.streak ?? stats?.streak,
      0
    ));
    const done = Array.isArray(tasks)
      ? tasks.filter(task => task.completed_at || task.done).length
      : toFiniteNumber(stats?.tasksCompleted, 0);
    const total = Array.isArray(tasks) ? tasks.length : 0;
    const completionRate = userBehavior?.avg_completion_rate !== undefined
      ? Math.round(toFiniteNumber(userBehavior.avg_completion_rate, 0) * 100)
      : total > 0
        ? Math.round((done / total) * 100)
        : 0;
    const reflectionsDone = toFiniteNumber(
      userBehavior?.total_reflections ?? stats?.reflectionsDone,
      0
    );
    const stage = getStage(score);

    return {
      score,
      vitality,
      streak,
      stage,
      progress: getProgress(score, stage),
      progressPercent: getProgress(score, stage),
      tasks: { done, total },
      todayTasks: { done, total },
      completionRate,
      reflectionsDone,
      message: stage.message,
      vitalityMsg: getVitalityMsg(vitality),
    };
  }, [stats, tasks, userBehavior, userTree]);

  useEffect(() => {
    const lastStageId = previousStageId.current;

    if (lastStageId && tree.stage.id > lastStageId) {
      const fromStage = STAGES.find(stage => stage.id === lastStageId);
      setStageUp({ from: fromStage, to: tree.stage });
      const timer = window.setTimeout(() => setStageUp(null), 3500);
      return () => window.clearTimeout(timer);
    }

    previousStageId.current = tree.stage.id;
  }, [tree.stage]);

  useEffect(() => {
    previousStageId.current = tree.stage.id;
  }, [tree.stage.id]);

  return {
    ...tree,
    loading: Boolean(user && userTree === undefined),
    refresh: loadStats,
    STAGES,
    stageUp,
    dismissStageUp: () => setStageUp(null),
  };
}
