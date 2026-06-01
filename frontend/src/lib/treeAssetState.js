const TREE_PHASES = [
  {
    level: 1,
    phase: "seed",
    label: "Seed",
    min: 0,
    max: 30,
    fallbackImage: "/media/tree/stage-1-seed.png",
  },
  {
    level: 2,
    phase: "sprout",
    label: "Sprout",
    min: 31,
    max: 80,
    fallbackImage: "/media/tree/stage-2-sprout.png",
  },
  {
    level: 3,
    phase: "sapling",
    label: "Sapling",
    min: 81,
    max: 180,
    fallbackImage: "/media/tree/stage-3-plant.png",
  },
  {
    level: 4,
    phase: "tree",
    label: "Tree",
    min: 181,
    max: 350,
    fallbackImage: "/media/tree/stage-4-small.png",
  },
  {
    level: 5,
    phase: "oak",
    label: "Oak",
    min: 351,
    max: Infinity,
    fallbackImage: "/media/tree/stage-6-mature.png",
  },
];

function toFiniteScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, score) : 0;
}

function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isFinite(localDate.getTime()) ? localDate : null;
  }

  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysMissed(lastCompletedDate) {
  const parsedDate = parseLocalDate(lastCompletedDate);
  if (!parsedDate) return Infinity;

  const today = startOfLocalDay(new Date());
  const lastCompletedDay = startOfLocalDay(parsedDate);
  const diffMs = today.getTime() - lastCompletedDay.getTime();
  const days = Math.floor(diffMs / 86400000);

  return Math.max(0, days);
}

function getPhaseForScore(totalScore) {
  const score = toFiniteScore(totalScore);
  return TREE_PHASES.find((phase) => (
    score >= phase.min && score <= phase.max
  )) ?? TREE_PHASES[0];
}

function getPhaseProgress(totalScore, phase) {
  const score = toFiniteScore(totalScore);
  if (phase.max === Infinity) return 100;

  const range = Math.max(1, phase.max - phase.min);
  const position = Math.max(0, score - phase.min);

  return Math.min(100, Math.round((position / range) * 100));
}

export function isToday(value) {
  const parsedDate = parseLocalDate(value);
  if (!parsedDate) return false;

  return startOfLocalDay(parsedDate).getTime() === startOfLocalDay(new Date()).getTime();
}

export function getTreeAssetState(totalScore, lastCompletedDate) {
  const score = toFiniteScore(totalScore);
  const phase = getPhaseForScore(score);
  const daysMissed = getDaysMissed(lastCompletedDate);
  const season = daysMissed <= 1 ? "spring" : "winter";

  return {
    score,
    phase: phase.phase,
    phaseLabel: phase.label,
    phaseLevel: phase.level,
    season,
    daysMissed,
    assetPath: phase.fallbackImage,
    fallbackImage: phase.fallbackImage,
    progress: getPhaseProgress(score, phase),
  };
}
