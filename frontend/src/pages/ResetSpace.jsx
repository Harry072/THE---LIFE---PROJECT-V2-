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
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";
import { useAppState } from "../contexts/AppStateContext";
import ContinuationCard from "../components/ContinuationCard";
import { evaluateCompletion, endChain } from "../hooks/useContinuationChain";
import "./MeditationPage.css";

const normalizeResetMood = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[-\s]+/g, "_");

function filterByNeed(items, activeNeed) {
  if (!activeNeed) return items;
  return items.filter((item) => item.needs.includes(activeNeed));
}

export default function ResetSpace() {
  const navigate = useNavigate();
  const { user } = useAppState();
  const [activeNeed, setActiveNeed] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [completedSessionId, setCompletedSessionId] = useState("");
  const [chainResult, setChainResult] = useState(null);

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

  const handleComplete = useCallback(async (session) => {
    setCompletedSessionId(session.id);
    // AudioPlayer's onComplete already unifies natural end, ambient-timer
    // completion, and finish-early into this single call site — no
    // duration gate here, all three fire identically.
    const result = await evaluateCompletion("reset_finished");
    if (result) setChainResult(result);
  }, []);

  const handleChainAccept = useCallback(() => {
    const route = chainResult?.nextRoute;
    setChainResult(null);
    if (route) navigate(route);
  }, [chainResult, navigate]);

  const handleChainDismiss = useCallback(() => {
    endChain();
    setChainResult(null);
  }, []);

  const handleClosePlayer = () => {
    setActiveSession(null);
    setCompletedSessionId("");
  };

  const handleSaveCheckin = useCallback(async ({
    session,
    moodAfter,
    reflectionTag,
    durationSeconds,
  }) => {
    if (!user?.id) {
      throw new Error("Sign in again to save this reset signal.");
    }

    const accessToken = await getSupabaseOrAppAccessToken(supabase);
    if (!accessToken) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(`${API_BASE_URL}/api/reset-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        session_title: session?.title,
        session_type: session?.type,
        duration_seconds: durationSeconds,
        mood_after_reset: normalizeResetMood(moodAfter),
        reset_reflection_tag: reflectionTag,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || `Server returned ${response.status}`);
    }

    return payload;
  }, [user?.id]);

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
            Settle your system before forcing action. Choose what you need now.
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

        {chainResult && (
          <div style={{ marginTop: 16 }}>
            <ContinuationCard
              headline={chainResult.headline}
              question={chainResult.question}
              nextFeatureName={chainResult.nextFeatureName}
              isTerminal={chainResult.isTerminal}
              onAccept={handleChainAccept}
              onDismiss={handleChainDismiss}
            />
          </div>
        )}
      </div>

      {activeSession ? (
        <AudioPlayer
          key={activeSession.id}
          session={activeSession}
          onClose={handleClosePlayer}
          onComplete={handleComplete}
          onSaveCheckin={handleSaveCheckin}
          onReturn={() => navigate("/loop")}
          onReflect={() => navigate("/reflection")}
        />
      ) : null}
    </main>
  );
}
