import { CURATOR_BOOKS, getBookById } from "./curatorData.js";

const LANE_LABELS = {
  current_direction: "For Your Current Direction",
  distracted: "If You Feel Distracted",
  lost: "If You Feel Lost",
  discipline: "If You Need Discipline",
  heavy: "If Your Mind Feels Heavy",
  weekly: "From Your Weekly Mirror",
};

const DEFAULT_CURRENT_BOOKS = ["atomic-habits", "mountain-is-you", "mans-search-for-meaning"];
const DISTRACTED_BOOKS = ["deep-work", "power-of-now", "thinking-fast-and-slow"];
const LOST_BOOKS = ["mans-search-for-meaning", "alchemist", "meditations"];
const DISCIPLINE_BOOKS = ["atomic-habits", "deep-work", "5am-club"];
const HEAVY_BOOKS = ["when-things-fall-apart", "untethered-soul", "power-of-now"];

const normalize = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[-\s]+/g, "_");

const countBy = (items, getValue) => items.reduce((counts, item) => {
  const value = normalize(getValue(item));
  if (!value) return counts;
  return { ...counts, [value]: (counts[value] || 0) + 1 };
}, {});

const includesAny = (values, terms) => values.some((value) => {
  const normalizedValue = normalize(value);
  return terms.some((term) => normalizedValue.includes(term));
});

const pathBookIds = (pathSlug, limit = 3) => CURATOR_BOOKS
  .filter((book) => book.pathSlug === pathSlug)
  .map((book) => book.id)
  .slice(0, limit);

const reason = {
  default:
    "Recommended as a steady place to begin while Curator gathers more safe signals.",
  direction:
    "Recommended because your current signals point toward a practical next direction.",
  distraction:
    "Recommended because recent safe signals suggest attention may be getting pulled away.",
  lost:
    "Recommended because your current direction may need more meaning and orientation.",
  discipline:
    "Recommended because recent task signals suggest discipline may need a simpler structure.",
  heavy:
    "Recommended because recent reset or task signals suggest your mind may need a gentler read.",
  weekly:
    "Recommended because this week's mirror points toward this kind of direction.",
  continuePath:
    "Recommended because you recently spent time with this reading path.",
  companion:
    "Recommended because your recent Companion direction involved reading or learning.",
};

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function addBooks(laneMap, laneKey, bookIds, recommendationReason, priority = 1) {
  const lane = laneMap.get(laneKey) || [];
  const seen = new Set(lane.map((item) => item.book.id));

  bookIds.forEach((bookId, index) => {
    const book = getBookById(bookId);
    if (!book || seen.has(book.id)) return;
    seen.add(book.id);
    lane.push({
      book,
      reason: recommendationReason,
      priority: priority - index * 0.01,
    });
  });

  laneMap.set(laneKey, lane);
}

function booksForWeeklyFocus(nextFocus) {
  const focus = normalize(nextFocus);
  if (!focus) return [];
  if (/(discipline|habit|consistency|focus|attention|study|work)/.test(focus)) {
    return DISCIPLINE_BOOKS;
  }
  if (/(purpose|meaning|direction|values|responsibility)/.test(focus)) {
    return LOST_BOOKS;
  }
  if (/(calm|rest|heavy|pressure|overthinking|emotion)/.test(focus)) {
    return HEAVY_BOOKS;
  }
  if (/(create|build|idea|work|project)/.test(focus)) {
    return ["war-of-art", "zero-to-one", "show-your-work"];
  }
  return DEFAULT_CURRENT_BOOKS;
}

export function buildCuratorIntelligence({
  user,
  activeBookIds = [],
  loopRows = [],
  resetRows = [],
  weeklyRows = [],
  companionRows = [],
  curatorRows = [],
} = {}) {
  const metadata = user?.user_metadata || {};
  const userBehavior = user?.user_behavior || {};
  const struggles = [
    ...safeArray(metadata.struggle_tags),
    ...safeArray(metadata.struggles),
    ...safeArray(metadata.onboarding_answers),
    ...safeArray(userBehavior.core_struggles),
  ].map(normalize);
  const loopMoodCounts = countBy(loopRows, (row) => row.mood_after || row.post_action_mood);
  const frictionCounts = countBy(loopRows, (row) => row.task_friction_level);
  const skippedCategoryCounts = countBy(
    loopRows.filter((row) => row.skipped),
    (row) => row.category,
  );
  const resetMoodCounts = countBy(resetRows, (row) => row.mood_after);
  const resetTagCounts = countBy(resetRows, (row) => row.reflection_tag);
  const companionIntentCounts = countBy(companionRows, (row) => row.companion_intent);
  const curatorPathCounts = countBy(curatorRows, (row) => row.path_slug);
  const latestWeekly = weeklyRows[0]?.synthesis_json || {};
  const nextFocus = typeof latestWeekly.next_focus === "string" ? latestWeekly.next_focus : "";

  const heavyTaskSignal =
    (loopMoodCounts.heavy || 0) + (loopMoodCounts.still_heavy || 0)
    + (loopMoodCounts.overwhelmed || 0) + (loopMoodCounts.drained || 0)
    + (frictionCounts.too_heavy || 0);
  const heavyResetSignal =
    (resetMoodCounts.still_heavy || 0) + (resetMoodCounts.restless || 0)
    + (resetMoodCounts.heavy || 0) + (resetMoodCounts.sleepy || 0);
  const distractedSignal =
    (resetTagCounts.overthinking || 0) + (resetTagCounts.scrolling || 0)
    + (skippedCategoryCounts.action || 0);
  const disciplineSignal =
    (frictionCounts.too_heavy || 0) + (skippedCategoryCounts.action || 0)
    + (loopMoodCounts.restless || 0);
  const lostSignal =
    (skippedCategoryCounts.meaning || 0)
    + (includesAny(struggles, ["lost", "purpose", "meaning", "direction"]) ? 1 : 0);
  const companionReadingSignal =
    (companionIntentCounts.book_recommendation || 0)
    + (companionIntentCounts.reading_request || 0)
    + (companionIntentCounts.reading_or_learning || 0)
    + (companionIntentCounts.curator_request || 0);

  const laneMap = new Map();
  const hasPersonalSignals = Boolean(
    struggles.length
    || loopRows.length
    || resetRows.length
    || nextFocus
    || companionRows.length
    || curatorRows.length
  );

  addBooks(
    laneMap,
    "current_direction",
    DEFAULT_CURRENT_BOOKS,
    hasPersonalSignals ? reason.direction : reason.default,
    1,
  );

  if (nextFocus) {
    const weeklyBookIds = booksForWeeklyFocus(nextFocus);
    addBooks(laneMap, "weekly", weeklyBookIds, reason.weekly, 1.4);
    addBooks(laneMap, "current_direction", weeklyBookIds.slice(0, 1), reason.weekly, 1.5);
  }

  if (distractedSignal || includesAny(struggles, ["distract", "focus", "scroll", "overthink"])) {
    addBooks(laneMap, "distracted", DISTRACTED_BOOKS, reason.distraction, 1.3);
  } else {
    addBooks(laneMap, "distracted", DISTRACTED_BOOKS.slice(0, 2), reason.default, 0.4);
  }

  if (lostSignal) {
    addBooks(laneMap, "lost", LOST_BOOKS, reason.lost, 1.3);
  } else {
    addBooks(laneMap, "lost", LOST_BOOKS.slice(0, 2), reason.default, 0.4);
  }

  if (disciplineSignal || includesAny(struggles, ["discipline", "habit", "consistent", "routine"])) {
    addBooks(laneMap, "discipline", DISCIPLINE_BOOKS, reason.discipline, 1.3);
  } else {
    addBooks(laneMap, "discipline", DISCIPLINE_BOOKS.slice(0, 2), reason.default, 0.4);
  }

  if (heavyTaskSignal || heavyResetSignal || includesAny(struggles, ["anxious", "heavy", "stress", "emotion"])) {
    addBooks(laneMap, "heavy", HEAVY_BOOKS, reason.heavy, 1.3);
  } else {
    addBooks(laneMap, "heavy", HEAVY_BOOKS.slice(0, 2), reason.default, 0.4);
  }

  const recentPath = Object.entries(curatorPathCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([pathSlug]) => pathSlug)
    .find(Boolean);
  if (recentPath) {
    addBooks(laneMap, "current_direction", pathBookIds(recentPath, 2), reason.continuePath, 1.25);
  }

  if (companionReadingSignal) {
    addBooks(laneMap, "current_direction", DEFAULT_CURRENT_BOOKS.slice(0, 2), reason.companion, 1.2);
  }

  const lanes = Object.entries(LANE_LABELS)
    .map(([key, title]) => {
      const recommendations = (laneMap.get(key) || [])
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);
      return {
        key,
        title,
        recommendations,
      };
    })
    .filter((lane) => lane.recommendations.length > 0);

  const topRecommendation = lanes
    .flatMap((lane) => lane.recommendations.map((item) => ({ ...item, laneKey: lane.key })))
    .sort((a, b) => b.priority - a.priority)[0] || null;
  const activeBook = activeBookIds.map(getBookById).find(Boolean);
  const readingPathBook = activeBook || topRecommendation?.book || getBookById(DEFAULT_CURRENT_BOOKS[0]);

  return {
    lanes,
    topRecommendation,
    readingPathBook,
    hasPersonalSignals,
    signalSummary: {
      nextFocus,
      struggleCount: struggles.length,
      taskSignalCount: loopRows.length,
      resetSignalCount: resetRows.length,
      curatorSignalCount: curatorRows.length,
    },
  };
}
