import { fetchDashboardPayload } from "./useDashboard";
import { getLocalDate } from "./usePatternReveal";
import { FEATURE_LABELS } from "../components/dashboard/FeatureGrid";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";

const STORAGE_KEY_PREFIX = "tlp.chain.";
// offersShown counts CARDS ACTUALLY PUT ON SCREEN, not events recorded.
// It was previously `depth`, incremented inside recordStep on every event —
// including the three passive ones whose return value the caller discards.
// A volunteer who opened Progress, a Curator book, and the Companion before
// doing any tasks therefore spent the whole budget on cards they never saw,
// and their first real completion came back terminal. completed[] answers
// "what has this user finished today"; offersShown answers "how many offers
// have we made" — two questions, two fields, neither inferred from the other.
const EMPTY_CHAIN = { offersShown: 0, completed: [], closed: false };
const MAX_CHAIN_DEPTH = 3;
const GENERIC_TERMINAL_HEADLINE = "That's enough for today.";
const EVENING_START_HOUR = 18;

// Maps each completion event to the dashboard `feature` it represents and
// its offer copy. pattern_reveal_viewed carries its own terminal copy since
// it is always terminal (never offers a next feature — insight after
// action, then stop).
const EVENT_CONFIG = {
  loop_done: {
    feature: "loop",
    headline: "Both tasks done. The tree grew today.",
    question: "Want to write one line about how that felt?",
  },
  journal_saved: {
    feature: "reflection",
    headline: "That's written down now.",
    question: "Want to see what the tree looks like today?",
  },
  pattern_reveal_viewed: {
    feature: "loop",
    headline: "That's yours to sit with.",
    question: "Nothing else needed right now.",
    forceTerminal: true,
  },
  reset_finished: {
    feature: "reset",
    headline: "You gave yourself that time.",
    question: "Anything you want to write down?",
  },
  // Phase 1.5 Part A — these three exist to populate completed[] (so the
  // dashboard's primary action and FeatureGrid's completion state can react
  // to them) rather than to render a new continuation card of their own; no
  // offer copy was specified for them, so callers on those pages discard
  // evaluateCompletion's return value.
  //
  // `passive: true` is the explicit marker that no card reaches the screen
  // for these. It is declared here rather than inferred from "has no
  // headline" so the two concerns — recording a completion vs. spending an
  // offer — stay separable and readable. See offersShown below.
  companion_engaged: { feature: "companion", passive: true },
  tree_viewed: { feature: "tree", passive: true },
  curator_explored: { feature: "curator", passive: true },
};

// The question must describe the button the user is about to press.
// EVENT_CONFIG's copy is static per EVENT, but selectNextFeature picks the
// target dynamically by orchestrator priority, so the two drifted apart: on
// the default first-completion path the card asked "Want to write one line
// about how that felt?" above a button reading "Open Companion". The
// headline stays event-derived (it describes what just happened, which is
// always correct); only the question is keyed to the actual target.
//
// Every line has to read naturally after ANY offer-bearing event, since any
// of them can now offer any feature. All are invitations — no streaks, no
// counts or fractions, no praise, no loss-aversion, no obligation.
const NEXT_STEP_QUESTIONS = {
  loop: "Want to take one small action now?",
  tree: "Want to see what the tree looks like today?",
  reflection: "Want to write one line about how that felt?",
  companion: "Want to talk any of it through?",
  reset: "Want to take a few quiet minutes?",
  curator: "Want something to read?",
};

const storageKey = () => `${STORAGE_KEY_PREFIX}${getLocalDate()}`;

// localStorage, not sessionStorage: chain depth (and "That's enough for
// today" closure) is a per-DAY limit, not a per-tab limit. A user who hits
// depth 3 and opens a new tab must still see the chain closed there —
// sessionStorage would silently reset to a fresh, unclosed chain in that
// new tab, defeating the depth cap. Stale-day keys are swept on every
// readChain() so this doesn't accumulate unbounded entries over time.
function cleanupStaleChainKeys(todayKey) {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(STORAGE_KEY_PREFIX) && key !== todayKey)
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // localStorage unavailable — nothing to clean up
  }
}

export function readChain() {
  const key = storageKey();
  cleanupStaleChainKeys(key);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...EMPTY_CHAIN };
    const parsed = JSON.parse(raw);
    return {
      // Falls back to the old `depth` field so a chain written earlier the
      // same day (before this shipped) still counts toward the cap instead of
      // silently resetting to 0 mid-session.
      offersShown: Number.isFinite(parsed?.offersShown)
        ? parsed.offersShown
        : (Number.isFinite(parsed?.depth) ? parsed.depth : 0),
      completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
      closed: Boolean(parsed?.closed),
    };
  } catch {
    return { ...EMPTY_CHAIN };
  }
}

function writeChain(chain) {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(chain));
  } catch {
    // localStorage unavailable — chain just won't persist
  }
}

// Records a completion ONLY. Spending an offer is recordOfferShown's job —
// keeping them separate is what stops a passive event from consuming the cap.
export function recordStep(feature) {
  const current = readChain();
  if (current.completed.includes(feature)) return current;
  const next = { ...current, completed: [...current.completed, feature] };
  writeChain(next);
  return next;
}

// Called only when a non-terminal card is actually returned to a caller that
// renders one.
function recordOfferShown() {
  const current = readChain();
  writeChain({ ...current, offersShown: current.offersShown + 1 });
}

export function endChain() {
  const current = readChain();
  writeChain({ ...current, closed: true });
}

export function isChainClosed() {
  return readChain().closed === true;
}

// ── Journey stages (Step 5A) ────────────────────────────────────────────────
//
// tlp.journey is client-side and user-editable. That is acceptable ONLY
// because the stage it tracks is never a safety gate, paywall, or access
// control — every one of the six features is always tappable from
// FeatureGrid regardless of stage (staged OFFERING, not staged access). The
// worst a hand-edit can do is see chain offers earlier for something the
// user could already reach directly by tapping the grid.
//
// The data conditions that decide stage 3 (journal count, task count) are
// read fresh from SERVER responses on every evaluation — never from
// tlp.journey, and never latched/remembered client-side — specifically so a
// user cannot edit localStorage to fake having journal entries and get a
// companion offer with nothing real to ground in.
//
// If days_active or offered[] is ever repurposed for anything
// safety-relevant, it MUST move server-side. Today it only reorders chain
// suggestions.
const JOURNEY_STORAGE_KEY = "tlp.journey";
const EMPTY_JOURNEY = { days_active: 0, last_active_date: "", offered: [] };
const DEEP_NIGHT_START_HOUR = 1;
const DEEP_NIGHT_END_HOUR = 5;

export function readJourney() {
  try {
    const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_JOURNEY };
    const parsed = JSON.parse(raw);
    return {
      days_active: Number.isFinite(parsed?.days_active) ? parsed.days_active : 0,
      last_active_date: typeof parsed?.last_active_date === "string" ? parsed.last_active_date : "",
      offered: Array.isArray(parsed?.offered) ? parsed.offered : [],
    };
  } catch {
    return { ...EMPTY_JOURNEY };
  }
}

function writeJourney(journey) {
  try {
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journey));
  } catch {
    // localStorage unavailable — journey tracking just won't persist
  }
}

// Lazy proxy for "app open": the first chain evaluation of a new calendar
// day bumps days_active. There is no mount-time hook here on purpose — nothing
// may fire a network call on mount, and this is local-storage-only anyway.
function touchJourneyDaysActive() {
  const today = getLocalDate();
  const current = readJourney();
  if (current.last_active_date === today) return current;
  const next = { ...current, days_active: current.days_active + 1, last_active_date: today };
  writeJourney(next);
  return next;
}

function recordOffered(feature) {
  const current = readJourney();
  if (current.offered.includes(feature)) return current;
  const next = { ...current, offered: [...current.offered, feature] };
  writeJourney(next);
  return next;
}

// Real, live reflections count — NOT user_behavior.total_reflections, which
// is a dead column nothing ever writes (confirmed in TreeStatCards.jsx).
// The only accurate source is GET /api/growth-tree/season's stats block,
// which is not part of the /api/dashboard payload the chain already fetches.
// Fetched lazily here (never on page mount) — this does mean a second
// network call per chain evaluation, alongside the existing dashboard fetch.
async function fetchSeasonStats() {
  const accessToken = await getSupabaseOrAppAccessToken(supabase);
  if (!accessToken) return null;

  const response = await fetch(`${API_BASE_URL}/api/growth-tree/season`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data?.stats || typeof data.stats.reflections_count !== "number") return null;
  return data.stats;
}

// Pure and independently testable. Crisis bypasses the sequential stages
// entirely (companion only, unrestricted) — in practice evaluateCompletion
// already returns null before ever reaching this call when crisis_active is
// true (the chain stays silent during a crisis: presence, not
// personalization — the existing, already-tested Phase 1 guarantee). This
// branch exists so the bypass itself is correct and verifiable on its own.
export function getStagePool(payload, seasonStats, now = new Date(), liveTasksCompletedToday) {
  if (Boolean(payload?.season?.crisis_active)) {
    return ["companion"];
  }

  // payload comes from fetchDashboardPayload(), which hits /api/dashboard —
  // cached server-side for 15 minutes with no invalidation on task
  // completion (see backend/ai/master_orchestrator.py's _dashboard_cache).
  // Loop task completion writes straight to Supabase (no backend endpoint
  // to invalidate the cache from), so callers that have a live task count
  // on hand (TheLoopPage.jsx's own useLoopTasks() state, PrimaryActionCard's
  // useAppState() tasks) pass it as liveTasksCompletedToday to bypass the
  // stale field entirely. Callers without one fall back to the cached
  // payload value — under-offers at worst (fails safe), never over-offers.
  const tasksCompletedToday = Number.isFinite(liveTasksCompletedToday)
    ? liveTasksCompletedToday
    : Number(payload?.tasks_today?.completed) || 0;
  const reflectionsCount = Number(seasonStats?.reflections_count) || 0;

  let pool = ["loop", "tree"];
  if (tasksCompletedToday >= 1) pool = ["loop", "tree", "reflection"];
  if (reflectionsCount >= 1 || tasksCompletedToday >= 2) pool = ["loop", "tree", "reflection", "companion"];
  pool = [...pool];

  const energyLow = payload?.season?.energy_level === "low";
  const hour = now.getHours();
  const isDeepNight = hour >= DEEP_NIGHT_START_HOUR && hour < DEEP_NIGHT_END_HOUR;
  if (energyLow || isDeepNight) pool.push("reset");

  if (reflectionsCount >= 1) pool.push("curator");

  return pool;
}

// Shared by PrimaryActionCard (what to SHOW as primary) and FeatureGrid
// (what to EXCLUDE from the discovery grid) — the two must agree on which
// feature is "primary" or a just-advanced-past feature can end up neither
// shown as primary nor visible in the grid. Crisis short-circuits before
// completed[] is ever consulted, same as the fail-closed pattern everywhere
// else in this file. Returns { card, isAllComplete }; card.feature is null
// only when isAllComplete or feature_cards is empty/malformed.
export function getAdvancedPrimaryFeature(payload, completed, liveTasksCompletedToday) {
  const crisisActive = Boolean(payload?.season?.crisis_active);
  const featureCards = Array.isArray(payload?.feature_cards) ? payload.feature_cards : [];
  const sortedCards = [...featureCards].sort((a, b) => a.priority - b.priority);

  if (crisisActive) {
    return { card: sortedCards.find((c) => c.feature === "companion") || null, isAllComplete: false };
  }

  const pool = getStagePool(payload, null, undefined, liveTasksCompletedToday);
  const poolEligible = sortedCards.filter((c) => pool.includes(c.feature) && !completed.includes(c.feature));
  const isAllComplete = pool.length > 0 && poolEligible.length === 0;

  if (isAllComplete) return { card: null, isAllComplete: true };

  // poolEligible, not sortedCards: this previously returned the highest-
  // priority uncompleted card WITHOUT applying the pool filter, while
  // selectNextFeature (the chain's own picker) did apply it. The dashboard
  // could therefore show Companion as primary while the chain offered
  // Reflection. poolEligible is already priority-sorted (it is a filter over
  // sortedCards) and is non-empty here — an empty one returns via
  // isAllComplete above, and getStagePool never yields an empty pool.
  return { card: poolEligible[0] || null, isAllComplete: false };
}

// Priority-ordered featureCards, filtered to the stage pool and to
// not-yet-completed features, then features never offered before (this
// session onward, tracked in tlp.journey.offered) come before features
// already offered — per-bucket order still follows orchestrator priority.
export function selectNextFeature(featureCards, completed, pool, offered) {
  const sorted = [...featureCards].sort((a, b) => a.priority - b.priority);
  const eligible = sorted.filter((card) => pool.includes(card.feature) && !completed.includes(card.feature));
  const notYetOffered = eligible.filter((card) => !offered.includes(card.feature));
  const alreadyOffered = eligible.filter((card) => offered.includes(card.feature));
  return notYetOffered[0] || alreadyOffered[0] || null;
}

// Step 5B — three terminal-copy variants. Pure and independently testable.
// Variant 2 states a fact ("will be here tonight"), never a request — no
// question mark, no button — and only fires when reflection is BOTH still
// incomplete AND actually in the user's current pool: a stage-1 user has
// never been introduced to the journal, so pointing at it would reference
// something they've never seen.
export function pickTerminalCopy(pool, completed, now = new Date()) {
  const isDaytime = now.getHours() < EVENING_START_HOUR;
  const reflectionInPool = pool.includes("reflection");
  const reflectionIncomplete = !completed.includes("reflection");

  if (isDaytime && reflectionInPool && reflectionIncomplete) {
    return {
      headline: "That's enough for now.",
      question: "The journal will be here tonight.",
    };
  }
  return { headline: GENERIC_TERMINAL_HEADLINE, question: null };
}

// The orchestration entry point every page calls on a completion event.
// Fails CLOSED at every step: chain already closed, a failed/invalid
// dashboard fetch, an active crisis flag, or a missing feature_cards array
// all resolve to null (no card) — the same outcome as an active crisis.
// The payload is fetched lazily, here, on-demand — never on page mount —
// so pages that wire this in make zero /api/dashboard calls unless a
// completion event actually fires.
export async function evaluateCompletion(eventKey, now = new Date(), liveTasksCompletedToday) {
  touchJourneyDaysActive();

  if (isChainClosed()) return null;

  const config = EVENT_CONFIG[eventKey];
  if (!config) return null;

  let payload = null;
  try {
    payload = await fetchDashboardPayload();
  } catch {
    payload = null;
  }
  if (!payload) return null;
  if (Boolean(payload?.season?.crisis_active)) return null;

  const featureCards = payload.feature_cards;
  if (!Array.isArray(featureCards) || featureCards.length === 0) return null;

  const before = readChain();
  if (before.completed.includes(config.feature)) return null;

  let seasonStats = null;
  try {
    seasonStats = await fetchSeasonStats();
  } catch {
    seasonStats = null;
  }
  const pool = getStagePool(payload, seasonStats, now, liveTasksCompletedToday);

  const chain = recordStep(config.feature);
  const journey = readJourney();

  const nextFeature = selectNextFeature(featureCards, chain.completed, pool, journey.offered);

  // `chain.offersShown + 1` reproduces the previous arithmetic exactly:
  // recordStep used to increment first and the check compared the already-
  // incremented value, so an offer-bearing sequence still shows the same
  // number of cards and terminates on the same event as before. The only
  // difference is that passive events no longer contribute to the count, and
  // are never terminated BY it (they show no card to terminate).
  const isTerminal = Boolean(config.forceTerminal)
    || (!config.passive && (chain.offersShown + 1) >= MAX_CHAIN_DEPTH)
    || !nextFeature;

  if (isTerminal) {
    endChain();
    if (config.forceTerminal) {
      return { isTerminal: true, headline: config.headline, question: config.question };
    }
    const copy = pickTerminalCopy(pool, chain.completed, now);
    return { isTerminal: true, headline: copy.headline, question: copy.question };
  }

  recordOffered(nextFeature.feature);
  if (!config.passive) recordOfferShown();

  return {
    isTerminal: false,
    headline: config.headline,
    // Keyed to the feature actually being offered, falling back to the
    // event's own copy only if a target ever lacks an entry.
    question: NEXT_STEP_QUESTIONS[nextFeature.feature] || config.question,
    nextFeatureName: FEATURE_LABELS[nextFeature.feature] || nextFeature.feature,
    nextRoute: nextFeature.route,
  };
}

export function useContinuationChain() {
  return { readChain, recordStep, endChain, isChainClosed, evaluateCompletion };
}
