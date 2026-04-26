import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, Sparkles } from "lucide-react";
import AudioPlayer from "../components/AudioPlayer";
import BreathPracticeSection from "../components/BreathPracticeSection";
import GuidedResetSection from "../components/GuidedResetSection";
import KnowledgeCard from "../components/KnowledgeCard";
import SoundSanctuarySection from "../components/SoundSanctuarySection";
import {
  BREATHING_PRACTICES,
  GUIDED_SESSIONS,
  KNOWLEDGE_CARDS,
  RESET_NEEDS,
  SOUND_SESSIONS,
} from "../data/sessions";
import "./MeditationPage.css";

function filterByNeed(items, activeNeed) {
  if (!activeNeed) return items;
  return items.filter((item) => item.needs.includes(activeNeed));
}

export default function ResetSpace() {
  const navigate = useNavigate();
  const [activeNeed, setActiveNeed] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [completedSessionId, setCompletedSessionId] = useState("");

  const guidedSessions = useMemo(
    () => filterByNeed(GUIDED_SESSIONS, activeNeed),
    [activeNeed],
  );
  const soundSessions = useMemo(
    () => filterByNeed(SOUND_SESSIONS, activeNeed),
    [activeNeed],
  );
  const breathingPractices = useMemo(
    () => filterByNeed(BREATHING_PRACTICES, activeNeed),
    [activeNeed],
  );

  const handleBeginSession = (session) => {
    setCompletedSessionId("");
    setActiveSession(session);
  };

  const handleComplete = useCallback((session) => {
    setCompletedSessionId(session.id);
  }, []);

  const handleClosePlayer = () => {
    setActiveSession(null);
    setCompletedSessionId("");
  };

  const selectedNeedLabel =
    RESET_NEEDS.find((need) => need.id === activeNeed)?.label || "All resets";

  return (
    <main className="meditation-page reset-space">
      <div className="med-bg-base reset-bg" />
      <div className="reset-forest-vignette" />

      <Link to="/dashboard" className="med-back-btn">
        <ArrowLeft size={18} aria-hidden="true" />
        Dashboard
      </Link>

      <div className="reset-shell">
        <header className="reset-hero">
          <div className="reset-hero-kicker">
            <Moon size={16} aria-hidden="true" />
            Reset Space
          </div>
          <h1>Return to yourself before the day takes over.</h1>
          <p>
            Choose what your nervous system needs now, then begin with guided audio,
            sound sanctuary, or a breathing rhythm.
          </p>
        </header>

        <section className="reset-need-panel" aria-labelledby="reset-needs-title">
          <div>
            <span>Need-based entry</span>
            <h2 id="reset-needs-title">{selectedNeedLabel}</h2>
          </div>
          <div className="reset-need-grid">
            {RESET_NEEDS.map((need) => (
              <button
                key={need.id}
                type="button"
                className={activeNeed === need.id ? "is-active" : ""}
                onClick={() => setActiveNeed((current) => (current === need.id ? "" : need.id))}
              >
                {need.label}
              </button>
            ))}
          </div>
        </section>

        <GuidedResetSection
          sessions={guidedSessions}
          activeNeed={activeNeed}
          onBegin={handleBeginSession}
        />

        <SoundSanctuarySection
          sessions={soundSessions}
          activeNeed={activeNeed}
          onBegin={handleBeginSession}
        />

        <BreathPracticeSection
          practices={breathingPractices}
          activeNeed={activeNeed}
        />

        <section className="reset-section" aria-labelledby="reset-knowledge-title">
          <div className="reset-section-heading">
            <span>Small truths</span>
            <h2 id="reset-knowledge-title">Knowledge Cards</h2>
            <p>Gentle context for the moments when practice feels harder than expected.</p>
          </div>
          <div className="reset-knowledge-grid">
            {KNOWLEDGE_CARDS.map((card) => (
              <KnowledgeCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {completedSessionId ? (
          <div className="reset-complete-note" aria-live="polite">
            <Sparkles size={16} aria-hidden="true" />
            Session complete. Choose one useful action next.
          </div>
        ) : null}
      </div>

      {activeSession ? (
        <AudioPlayer
          key={activeSession.id}
          session={activeSession}
          onClose={handleClosePlayer}
          onComplete={handleComplete}
          onReturn={() => navigate("/loop")}
        />
      ) : null}
    </main>
  );
}
