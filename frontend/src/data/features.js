// Single source of truth for feature vocabulary and ordering.
//
// JOURNEY_ORDER previously lived only in FeatureGrid.jsx while the chain
// ordered offers by card.priority (server-side, six adaptive orderings in
// master_orchestrator.py). Two independent orderings meant the numbered
// journey read 1 Loop / 2 Growth Tree / 3 Reflection / 4 Companion while the
// chain offered Companion straight after Loop -- visibly skipping 2 and 3.
// They could not be reconciled even in principle: six adaptive orderings
// against one fixed path.
//
// The two now have separate jobs:
//   JOURNEY_ORDER  -> governs the continuation chain. Stable and numbered,
//                     because a new user builds a mental model from it.
//   card.priority  -> governs the dashboard primary card only, still adaptive,
//                     because "what should I do right now" depends on state.
//
// This module exists so both consumers read ONE list. FeatureGrid.jsx and
// useContinuationChain.js both import from here and no longer from each other
// (they previously formed an import cycle via FEATURE_LABELS).

export const FEATURE_LABELS = {
  loop: "The Loop",
  companion: "Companion",
  reflection: "Reflection",
  tree: "Growth Tree",
  curator: "Curator",
  reset: "Reset Space",
};

// The numbered path, rendered as 1-4 in the dashboard journey row and walked
// in this exact order by the chain. Changing this array changes both at once.
export const JOURNEY_ORDER = ["loop", "tree", "reflection", "companion"];

// Always-available, never sequenced -- these are not steps in the path, so
// they are not numbered and cannot outrank a journey step.
export const RESPONSIVE_ORDER = ["reset", "curator"];

// Derived, never typed a second time: the chain's full walk order. Journey
// steps first, then the responsive features as a fallback tier. Any feature
// the server sends that appears in neither list is appended at the tail by
// selectNextFeature so it stays reachable rather than silently unreachable.
export const CHAIN_ORDER = [...JOURNEY_ORDER, ...RESPONSIVE_ORDER];
