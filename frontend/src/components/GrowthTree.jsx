import { useEffect, useMemo, useState } from "react";
import { useGrowthTree } from "../hooks/useGrowthTree";
import { getTreeAssetState, isToday } from "../lib/treeAssetState";

const RECOVERY_SEASON_KEY = "lifeproject_growth_tree_previous_season";

const SEASON_COPY = {
  spring: "The roots deepen with every action.",
  winter: "The storm stripped the leaves, but the roots hold. One action brings the spring.",
  recovery: "The first drop of rain. The tree remembers.",
};

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

function readPreviousSeason() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(RECOVERY_SEASON_KEY);
  } catch {
    return null;
  }
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
  const [failedAsset, setFailedAsset] = useState(null);
  const [previousSeason] = useState(readPreviousSeason);

  const treeState = useMemo(
    () => getTreeAssetState(score, lastCompletedDate),
    [lastCompletedDate, score],
  );

  const hasCompletedToday = tasks.done > 0 && isToday(lastCompletedDate);
  const isRecovery = treeState.season === "spring"
    && hasCompletedToday
    && previousSeason === "winter";
  const seasonTone = isRecovery ? "recovery" : treeState.season;
  const imageSrc = failedAsset === treeState.assetPath
    ? treeState.fallbackImage
    : treeState.assetPath;
  const height = compact ? 300 : 420;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(RECOVERY_SEASON_KEY, treeState.season);
    } catch {
      // Recovery memory is decorative; the tree still renders without it.
    }
  }, [treeState.season]);

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
      className={`growth-tree-shell growth-tree-${treeState.season}${compact ? " is-compact" : ""}`}
      style={{ "--growth-tree-height": `${height}px` }}
    >
      {!compact && <p className="growth-tree-kicker">Growth Tree</p>}

      <div className="growth-tree-frame">
        <img
          key={treeState.assetPath}
          src={imageSrc}
          alt={`${treeState.phaseLabel} in ${treeState.season}`}
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

      <div className={`growth-tree-season-copy is-${seasonTone}`}>
        <p>{SEASON_COPY[seasonTone]}</p>
        <span>
          Level {treeState.phaseLevel} - {treeState.phaseLabel} - {formatMissedDays(treeState.daysMissed)}
        </span>
      </div>
    </div>
  );
}
