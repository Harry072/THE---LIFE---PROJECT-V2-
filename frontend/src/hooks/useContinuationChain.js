import { fetchDashboardPayload } from "./useDashboard";
import { getLocalDate } from "./usePatternReveal";
import { CHAIN_ORDER, FEATURE_LABELS } from "../data/features";
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
// Counts EVENTS, not offer cards: the terminal check below fires at
// (offersShown + 1) >= MAX_CHAIN_DEPTH, so the terminal itself is the third
// event. A session therefore shows at most TWO offer cards, then a terminal —
// not three offers. Two is deliberate, not an off-by-one: the product
// minimizes engagement (one action, one natural follow-on, then rest), so it
// is not a nudge to keep a volunteer clicking through a third and fourth
// card. Do not "fix" the arithmetic to mean three offers.
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
  // `passive: true` means "produces no card BY DEFAULT". It is no longer the
  // whole story: a caller that will actually render the result passes
  // { rendersCard: true } and the event becomes offer-bearing for that call
  // only. tree_viewed needs this because its completion moment is bare
  // ARRIVAL -- the chain sends users to the tree (journey position 2), and a
  // destination the chain chose must not be a dead end. Browsing to the tree
  // from the sidebar still renders nothing and still costs no depth, which is
  // the F3 guarantee.
  companion_engaged: {
    feature: "companion",
    passive: true,
    headline: "You said it out loud.",
  },
  tree_viewed: {
    feature: "tree",
    passive: true,
    headline: "That's where your tree is today.",
  },
  curator_explored: {
    feature: "curator",
    passive: true,
    headline: "That's on your shelf now.",
  },
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

// The session's CLOSING card. Not a third forward offer -- it is the terminal,
// carrying an invitation instead of a full stop, for the one case where the
// journey's own next step is companion. Accepting goes to Companion; declining
// ends the session with no second card. Either way the chain is already closed
// by the terminal branch, so nothing can follow it.
//
// An invitation, never a request: no streaks, no counts, no praise, no
// loss-aversion, no obligation, no "you should".
const COMPANION_CLOSING_COPY = {
  headline: "That's a lot to sit with.",
  question: "Want to talk it through?",
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
// Same value and same mechanism as DASHBOARD_FETCH_TIMEOUT_MS in
// useDashboard.js — one timeout idiom in this file family, not two.
//
// This endpoint had no timeout while its sibling /api/dashboard did. A
// try/catch catches a REJECTION, never a HANG: on a cold-started or stalled
// backend the await below simply never settled, so evaluateCompletion never
// returned, setChainResult was never called, and the user saw no card, no
// error, and nothing written to localStorage — the exact "nothing happens"
// symptom, and one no amount of clearing chain state could fix.
const SEASON_FETCH_TIMEOUT_MS = 8000;

async function fetchSeasonStats() {
  const accessToken = await getSupabaseOrAppAccessToken(supabase);
  if (!accessToken) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEASON_FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/growth-tree/season`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
  } catch (error) {
    // Abort returns null, which the call site already turns into
    // seasonStats = null -> reflectionsCount 0 -> companion and curator stay
    // OUT of the pool. That is the documented fail-safe direction: it
    // under-offers, and can never grant unearned access to a gated feature.
    // Any other failure rethrows exactly as before; evaluateCompletion's own
    // try/catch around this call already maps that to null too.
    if (error?.name === "AbortError") return null;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

// Walks CHAIN_ORDER (the fixed journey path), NOT card.priority. Returns the
// first feature that is both in the stage pool and not completed today.
//
// card.priority still exists and still governs the dashboard primary card via
// getAdvancedPrimaryFeature — it is deliberately not consulted here. Ordering
// the chain by priority is what let Companion (server priority 2) be offered
// straight after Loop while the journey row numbered it 4, visibly skipping
// steps 2 and 3.
//
// The previous `offered` tie-break (prefer never-offered features) is
// deliberately gone: it reordered the path per user history, which is exactly
// what a stable numbered path must not do. A dismissed-but-incomplete Tree is
// still step 2 and is offered again. recordOffered still tracks offers for the
// journey store; selection simply no longer consults it.
export function selectNextFeature(featureCards, completed, pool) {
  const cards = Array.isArray(featureCards) ? featureCards : [];
  const byFeature = new Map(cards.map((card) => [card.feature, card]));

  // Anything the server sends that CHAIN_ORDER doesn't know about keeps its
  // relative priority order at the tail — unknown features stay reachable
  // instead of being silently dropped from the chain entirely.
  const trailing = cards
    .filter((card) => !CHAIN_ORDER.includes(card.feature))
    .sort((a, b) => a.priority - b.priority)
    .map((card) => card.feature);

  for (const feature of [...CHAIN_ORDER, ...trailing]) {
    if (!pool.includes(feature)) continue;
    if (completed.includes(feature)) continue;
    const card = byFeature.get(feature);
    if (card) return card;
  }
  return null;
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
export async function evaluateCompletion(
  eventKey,
  now = new Date(),
  liveTasksCompletedToday,
  { rendersCard = false } = {},
) {
  touchJourneyDaysActive();

  if (isChainClosed()) return null;

  const config = EVENT_CONFIG[eventKey];
  if (!config) return null;

  let payload = null;
  try {
    // fresh: a completion event just fired, so the cached tasks_today from
    // before it is exactly the wrong number to reason about. Only this path
    // asks for it -- the dashboard's own render still reads cache.
    payload = await fetchDashboardPayload({ fresh: true });
  } catch {
    payload = null;
  }
  if (!payload) return null;
  if (Boolean(payload?.season?.crisis_active)) return null;

  const featureCards = payload.feature_cards;
  if (!Array.isArray(featureCards) || featureCards.length === 0) return null;

  // ── ATOMIC CLAIM ─────────────────────────────────────────────────────────
  // These two statements are deliberately adjacent and synchronous. The claim
  // used to sit AFTER the fetchSeasonStats await below, which made this a
  // check -> await -> write sequence: two concurrent invocations both read
  // `before` before either wrote, both passed the guard, and both reached
  // recordOfferShown() -- so a single completion counted as two offers.
  // StrictMode's dev double-invoke of a mount effect triggers this every time
  // (ProgressPage's tree_viewed), which is what turned a Reflection offer into
  // a terminal card: offersShown hit 2, then (2+1) >= MAX_CHAIN_DEPTH.
  // localStorage read-modify-write cannot interleave, so claiming here closes
  // the window without any new state.
  //
  // Placement is load-bearing: this sits AFTER the fail-closed payload check
  // and AFTER the crisis check above, so a turn that returns null for safety
  // or because the backend hung never consumes the feature.
  const before = readChain();
  if (before.completed.includes(config.feature)) return null;
  const chain = recordStep(config.feature);

  let seasonStats = null;
  try {
    seasonStats = await fetchSeasonStats();
  } catch {
    seasonStats = null;
  }
  const pool = getStagePool(payload, seasonStats, now, liveTasksCompletedToday);

  const nextFeature = selectNextFeature(featureCards, chain.completed, pool);

  // `chain.offersShown + 1` reproduces the previous arithmetic exactly:
  // recordStep used to increment first and the check compared the already-
  // incremented value, so an offer-bearing sequence still shows the same
  // number of cards and terminates on the same event as before. The only
  // difference is that passive events no longer contribute to the count, and
  // are never terminated BY it (they show no card to terminate).
  // Only the CALLER knows whether a card reaches the screen, so a passive
  // event that is being rendered this call counts as a real offer: it is
  // terminal-by-depth like any other, and it spends an offer below.
  const isPassive = Boolean(config.passive) && !rendersCard;

  // +1 here is "if we showed this one" — so this is the CEILING check, not a
  // count of offers already shown. At MAX_CHAIN_DEPTH=3 that ceiling is hit
  // on the event that would be the third, which is why it becomes the
  // terminal instead of a third offer: two offers shown, then stop.
  const isTerminal = Boolean(config.forceTerminal)
    || (!isPassive && (chain.offersShown + 1) >= MAX_CHAIN_DEPTH)
    || !nextFeature;

  if (isTerminal) {
    // Closing is what "That's enough for today" MEANS to the user, so it may
    // only happen when they actually saw it. isPassive is already this file's
    // term for "no card reaches the screen" (F3), so a direct visit to the
    // tree that finds nothing eligible now records the visit and leaves the
    // chain OPEN -- previously it fired endChain() silently and killed the
    // rest of the user's day from a page that displayed nothing.
    // A genuine terminal (depth max, or forceTerminal's pattern reveal) is
    // never passive, so it still closes and still renders its copy.
    if (!isPassive) endChain();
    if (config.forceTerminal) {
      return { isTerminal: true, headline: config.headline, question: config.question };
    }

    // The closing beat. The journey walk above ALREADY established that
    // companion is in the stage pool and not yet completed -- that is what it
    // means for nextFeature to be companion -- so this cannot force a
    // companion offer onto a session that never earned it. A session that
    // stopped short of reflection has nextFeature = reflection (or null) and
    // falls through to the bare terminal below, unchanged.
    //
    // forceTerminal is handled above, so the pattern reveal keeps its own
    // terminal. Crisis never reaches here at all (evaluateCompletion returns
    // null on crisis_active long before this).
    //
    // Still isTerminal: endChain() has already run, and recordOfferShown()
    // below is unreachable from this branch, so offersShown stays at the
    // two-offer ceiling and nothing can chain after it.
    if (nextFeature && nextFeature.feature === "companion") {
      return {
        isTerminal: true,
        headline: COMPANION_CLOSING_COPY.headline,
        question: COMPANION_CLOSING_COPY.question,
        nextFeatureName: FEATURE_LABELS.companion || "Companion",
        nextRoute: nextFeature.route,
      };
    }

    const copy = pickTerminalCopy(pool, chain.completed, now);
    return { isTerminal: true, headline: copy.headline, question: copy.question };
  }

  recordOffered(nextFeature.feature);
  if (!isPassive) recordOfferShown();

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
