// DEV-ONLY testing affordance. Never ships: the whole component body is behind
// `import.meta.env.DEV`, which Vite statically replaces with `false` in a
// production build, so the minifier drops everything below it as dead code.
// Same gate the existing dev overrides in GrowthTree.jsx:29,37 use.
//
// Why this exists: chain state is day-scoped in localStorage. One "Not now"
// tap calls endChain() and sets closed:true for the rest of the LOCAL day, and
// a completed feature stays in completed[] just as long. Both make
// evaluateCompletion return null on every later completion
// (useContinuationChain.js:405 and :423), so a second test of the same flow
// silently shows nothing. Before this, the only ways out were editing
// localStorage by hand or waiting for local midnight.
//
// A button rather than a URL param or keyboard shortcut: the reported testing
// is on a phone, where there is no DevTools console and no physical keyboard,
// and a param has to be retyped after every navigation.

const CHAIN_PREFIX = "tlp.chain.";
const JOURNEY_KEY = "tlp.journey";
const REVEAL_PREFIX = "pattern_reveal_dismissed_";

export default function DevChainReset() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;

  const reset = () => {
    try {
      // Every chain day, not just today: a device whose clock crossed midnight
      // mid-test can otherwise leave a stale day behind.
      Object.keys(window.localStorage)
        .filter(
          (key) =>
            key.startsWith(CHAIN_PREFIX) ||
            key.startsWith(REVEAL_PREFIX) ||
            key === JOURNEY_KEY,
        )
        .forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // localStorage unavailable — nothing to clear
    }
    // Full reload: chain state is read at evaluation time, but pages hold
    // chainResult in React state, and usePatternReveal caches its check in a
    // ref for the lifetime of the mount.
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={reset}
      title="DEV ONLY — clears tlp.chain.*, tlp.journey, pattern_reveal_dismissed_* and reloads"
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 2147483647,
        padding: "6px 10px",
        borderRadius: 6,
        border: "2px dashed #000",
        background: "#ff00ff",
        color: "#000",
        font: "700 11px/1 monospace",
        letterSpacing: "0.04em",
        cursor: "pointer",
        opacity: 0.85,
      }}
    >
      DEV: RESET CHAIN
    </button>
  );
}
