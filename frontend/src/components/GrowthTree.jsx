import { useEffect, useMemo, useRef, useState } from "react";
import { useGrowthTree } from "../hooks/useGrowthTree";
import { useTreeSeason } from "../hooks/useTreeSeason";
import { getTreeAssetState } from "../lib/treeAssetState";

const MILESTONE_VISIBLE_MS = 12000;
const MILESTONE_FADE_MS = 800;

// Fallback copy for when the season endpoint is unreachable — the tree
// then renders exactly as it did before the season engine existed.
const FALLBACK_COPY = {
  spring: "The roots deepen with every action.",
  winter: "The storm stripped the leaves, but the roots hold. One action brings the spring.",
};

const KNOWN_HINTS = new Set(["morning", "rain", "winter", "dawn", "storm"]);

// DEV-only demo copy so ?tree_hint=<hint> renders a complete state.
const DEV_HINT_MESSAGES = {
  morning: "The roots deepen with every action.",
  rain: "Growth happens in the rain too. The roots deepen in resistance.",
  winter: "Rest is also a season. The roots are still holding.",
  dawn: "You came back. That's enough. The roots were waiting.",
  storm: "The tree stands through the storm. So do you.",
};

function readDevHintOverride() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const hint = new URLSearchParams(window.location.search).get("tree_hint");
  return KNOWN_HINTS.has(hint) ? hint : null;
}

// DEV-only: ?tree_milestone=1 renders a sample crossing (latch bypassed
// so it can be replayed on refresh while designing).
function readDevMilestoneOverride() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("tree_milestone") !== "1") return null;
  return {
    crossed: true,
    stage_name: "Young Plant",
    stage_message: "You're building real strength.",
  };
}

const PARTICLES = [
  { left: "14%", top: "72%", delay: "0.2s", duration: "8s" },
  { left: "27%", top: "64%", delay: "1.1s", duration: "10s" },
  { left: "42%", top: "76%", delay: "0.7s", duration: "9s" },
  { left: "58%", top: "69%", delay: "1.8s", duration: "11s" },
  { left: "73%", top: "74%", delay: "0.4s", duration: "8.5s" },
  { left: "84%", top: "61%", delay: "1.4s", duration: "10.5s" },
];

function TreeMark({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-bright)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 22V12" />
      <path d="M12 12c-3-1-5-3-5-6 0-2.2 2-4 5-4s5 1.8 5 4c0 3-2 5-5 6z" />
      <path d="M12 16c-2.8 0-5 1.7-6 4" />
      <path d="M12 16c2.8 0 5 1.7 6 4" />
    </svg>
  );
}

function formatMissedDays(daysMissed) {
  if (!Number.isFinite(daysMissed)) return "No recent action";
  if (daysMissed === 0) return "Completed today";
  if (daysMissed === 1) return "Last action yesterday";
  return `${daysMissed} quiet days`;
}

export default function GrowthTree({ compact = false }) {
  const {
    score,
    tasks,
    loading,
    lastCompletedDate,
  } = useGrowthTree();
  const { season } = useTreeSeason();
  const [failedAsset, setFailedAsset] = useState(null);
  const [devHint] = useState(readDevHintOverride);
  const [devMilestone] = useState(readDevMilestoneOverride);
  const [milestonePhase, setMilestonePhase] = useState("idle");
  const milestoneTimersRef = useRef([]);

  const milestone = devMilestone || season?.milestone;

  // Earned silence: the line fades in (0.8s), stays 12s, fades out (0.8s),
  // and is never shown again this session (sessionStorage latch per stage).
  useEffect(() => {
    if (!milestone?.crossed || !milestone?.stage_message) return undefined;

    if (!devMilestone) {
      const latchKey = `tlp.tree.milestone.${milestone.stage_name}`;
      try {
        if (window.sessionStorage.getItem(latchKey)) return undefined;
        window.sessionStorage.setItem(latchKey, "1");
      } catch {
        // Storage unavailable → still shows at most once per mount.
      }
    }

    setMilestonePhase("showing");
    const leaveTimer = window.setTimeout(
      () => setMilestonePhase("leaving"),
      MILESTONE_VISIBLE_MS,
    );
    const doneTimer = window.setTimeout(
      () => setMilestonePhase("done"),
      MILESTONE_VISIBLE_MS + MILESTONE_FADE_MS,
    );
    milestoneTimersRef.current = [leaveTimer, doneTimer];
    return () => milestoneTimersRef.current.forEach(window.clearTimeout);
  }, [milestone, devMilestone]);

  const treeState = useMemo(
    () => getTreeAssetState(score, lastCompletedDate),
    [lastCompletedDate, score],
  );

  // Server-driven weather. Unknown/missing hint → legacy spring/winter
  // classes, i.e. the tree renders exactly as before the season engine.
  const hint = devHint
    || (KNOWN_HINTS.has(season?.visual_hint) ? season.visual_hint : null);
  const shellSeasonClass = hint
    ? `growth-tree-hint-${hint}`
    : `growth-tree-${treeState.season}`;
  const seasonMessage = devHint
    ? DEV_HINT_MESSAGES[devHint]
    : (season?.message || FALLBACK_COPY[treeState.season]);
  const copyToneClass = hint ? `is-${hint}` : `is-${treeState.season}`;

  const imageSrc = failedAsset === treeState.assetPath
    ? treeState.fallbackImage
    : treeState.assetPath;
  const height = compact ? 300 : 420;

  if (loading) {
    return (
      <div className="growth-tree-shell" style={{ "--growth-tree-height": `${height}px` }}>
        {!compact && <p className="growth-tree-kicker">Growth Tree</p>}
        <div className="growth-tree-frame growth-tree-loading" />
      </div>
    );
  }

  return (
    <div
      className={`growth-tree-shell ${shellSeasonClass}${compact ? " is-compact" : ""}`}
      style={{ "--growth-tree-height": `${height}px` }}
    >
      {!compact && <p className="growth-tree-kicker">Growth Tree</p>}

      <div className="growth-tree-frame">
        <img
          key={treeState.assetPath}
          src={imageSrc}
          alt={`${treeState.phaseLabel}${hint ? ` — ${hint}` : ""}`}
          className="growth-tree-image"
          onError={() => {
            if (imageSrc !== treeState.fallbackImage) {
              setFailedAsset(treeState.assetPath);
            }
          }}
        />

        <div className="growth-tree-vignette" />
        <div className="growth-tree-glow" />
        <div className="growth-tree-storm" />

        <div className="growth-tree-particles" aria-hidden="true">
          {PARTICLES.slice(0, compact ? 4 : PARTICLES.length).map((particle, index) => (
            <span
              key={index}
              style={{
                "--particle-left": particle.left,
                "--particle-top": particle.top,
                "--particle-delay": particle.delay,
                "--particle-duration": particle.duration,
              }}
            />
          ))}
        </div>

        <div className="growth-tree-stat-panel">
          <div className="growth-tree-stat-row">
            <div className="growth-tree-score">
              <TreeMark size={compact ? 16 : 18} />
              <span>Resilience</span>
              <strong>{treeState.score} pts.</strong>
            </div>
            <span className="growth-tree-task-count">
              {tasks.done}/{tasks.total} {compact ? "Tasks" : "Tasks Completed"}
            </span>
          </div>

          <div className="growth-tree-progress-track">
            <div
              className="growth-tree-progress-fill"
              style={{ width: `${treeState.progress}%` }}
            />
          </div>
        </div>
      </div>

      {(milestonePhase === "showing" || milestonePhase === "leaving") && (
        <div
          className={`growth-tree-milestone${milestonePhase === "leaving" ? " is-leaving" : ""}`}
          role="status"
        >
          <p>{milestone.stage_message}</p>
        </div>
      )}

      <div className={`growth-tree-season-copy ${copyToneClass}`}>
        <p>{seasonMessage}</p>
        <span>
          Level {treeState.phaseLevel} - {treeState.phaseLabel} - {formatMissedDays(treeState.daysMissed)}
        </span>
      </div>
    </div>
  );
}
