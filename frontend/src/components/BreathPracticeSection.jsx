import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Wind } from "lucide-react";

function formatPracticeTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function PracticeCard({ practice, activeNeed }) {
  const totalSeconds = practice.duration * 60;
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const phaseTimeline = useMemo(() => {
    return practice.phases.reduce((timeline, phase, index) => {
      const start = index === 0 ? 0 : timeline[index - 1].end;
      return [...timeline, { ...phase, start, end: start + phase.seconds }];
    }, []);
  }, [practice.phases]);

  const cycleLength = phaseTimeline[phaseTimeline.length - 1]?.end || 1;
  const cycleProgress = elapsed % cycleLength;
  const currentPhase =
    phaseTimeline.find((phase) => cycleProgress >= phase.start && cycleProgress < phase.end)
    || phaseTimeline[0];
  const secondsInPhase = cycleProgress - currentPhase.start;
  const phaseRemaining = Math.max(1, currentPhase.seconds - secondsInPhase);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= totalSeconds) {
          setIsRunning(false);
          return totalSeconds;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, totalSeconds]);

  const resetPractice = () => {
    setIsRunning(false);
    setElapsed(0);
  };

  const isHighlighted = Boolean(activeNeed && practice.needs.includes(activeNeed));
  const isComplete = elapsed >= totalSeconds;

  return (
    <article className={`reset-breath-card ${isHighlighted ? "is-highlighted" : ""}`}>
      <div className="reset-breath-orb-wrap">
        <div
          className={`reset-breath-orb ${isRunning ? "is-running" : ""}`}
          style={{ transform: `scale(${isRunning ? currentPhase.scale : 1})` }}
        >
          <span>{isRunning ? phaseRemaining : "Ready"}</span>
          <small>{isRunning ? currentPhase.label : practice.category}</small>
        </div>
      </div>

      <div className="reset-breath-copy">
        <div className="reset-session-meta">
          <span><Wind size={15} aria-hidden="true" /> {practice.category}</span>
          <span>{practice.duration} min</span>
        </div>
        <h3>{practice.title}</h3>
        <p>{practice.description}</p>
        <p className="reset-session-why">{practice.whyThisHelps}</p>
      </div>

      <div className="reset-breath-footer">
        <span>{isComplete ? "Complete" : formatPracticeTime(totalSeconds - elapsed)}</span>
        <div>
          <button
            type="button"
            className="reset-icon-button"
            onClick={() => setIsRunning((current) => !current)}
            aria-label={isRunning ? "Pause breathing practice" : "Start breathing practice"}
            disabled={isComplete}
          >
            {isRunning ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="reset-icon-button"
            onClick={resetPractice}
            aria-label="Reset breathing practice"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BreathPracticeSection({ practices, activeNeed }) {
  return (
    <section className="reset-section" aria-labelledby="breath-practice-title">
      <div className="reset-section-heading">
        <span>Nervous system</span>
        <h2 id="breath-practice-title">Breath Practice</h2>
        <p>Visual breathing rhythms for immediate regulation, focus, and emotional decompression.</p>
      </div>
      <div className="reset-breath-grid">
        {practices.map((practice) => (
          <PracticeCard key={practice.id} practice={practice} activeNeed={activeNeed} />
        ))}
      </div>
    </section>
  );
}
