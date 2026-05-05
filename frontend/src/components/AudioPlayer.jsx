import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import PostSessionCheckin from "./PostSessionCheckin";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default function AudioPlayer({
  session,
  onClose,
  onComplete,
  onSaveCheckin,
  onReturn,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(() => session.duration * 60);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showCheckin, setShowCheckin] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState("");
  const [selectedReflectionTag, setSelectedReflectionTag] = useState("");
  const [isSavingCheckin, setIsSavingCheckin] = useState(false);
  const [checkinError, setCheckinError] = useState("");
  const [checkinSaved, setCheckinSaved] = useState(false);
  const isAmbientScript = session.guidanceType === "ambient_script";
  const targetDuration = session.duration * 60;
  const playbackSrc = session.voiceSrc || session.audioSrc || "";
  const activeScriptStep = isAmbientScript
    ? [...(session.scriptSteps || [])]
      .reverse()
      .find((step) => progress >= step.time)
    : null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.pause();
    audio.currentTime = 0;
    audio.loop = isAmbientScript;
    audio.src = playbackSrc;
    audio.load();

    const handleLoaded = () => {
      setDuration(
        isAmbientScript || !Number.isFinite(audio.duration)
          ? targetDuration
          : audio.duration,
      );
      setError("");
    };
    const handleTime = () => {
      if (!isAmbientScript) {
        setProgress(audio.currentTime || 0);
      }
    };
    const handleError = () => {
      setIsPlaying(false);
      setError("Sorry, audio is unavailable for this session.");
    };
    const handleEnded = () => {
      if (isAmbientScript) return;
      setIsPlaying(false);
      setProgress(audio.duration || targetDuration);
      setShowCheckin(true);
      onComplete(session);
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.loop = false;
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isAmbientScript, onComplete, playbackSrc, session, targetDuration]);

  useEffect(() => {
    if (!isAmbientScript || !isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const nextProgress = Math.min(targetDuration, current + 1);
        if (nextProgress >= targetDuration) {
          const audio = audioRef.current;
          if (audio) {
            audio.pause();
          }
          setIsPlaying(false);
          setShowCheckin(true);
          onComplete(session);
        }
        return nextProgress;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAmbientScript, isPlaying, onComplete, session, targetDuration]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setError("Sorry, audio is unavailable for this session.");
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (event) => {
    const nextProgress = Number(event.target.value);
    setProgress(nextProgress);
    if (audioRef.current && !isAmbientScript) {
      audioRef.current.currentTime = nextProgress;
    }
  };

  const handleSubmitCheckin = async () => {
    if (!selectedFeeling || !selectedReflectionTag || isSavingCheckin) return;
    setIsSavingCheckin(true);
    setCheckinError("");
    try {
      await onSaveCheckin?.({
        session,
        moodAfter: selectedFeeling,
        reflectionTag: selectedReflectionTag,
        durationSeconds: Math.round(progress || targetDuration),
      });
      setCheckinSaved(true);
    } catch (requestError) {
      setCheckinError(requestError?.message || "Could not save this reset signal yet.");
    } finally {
      setIsSavingCheckin(false);
    }
  };

  const remaining = Math.max(0, duration - progress);
  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div className="reset-player-overlay" role="dialog" aria-modal="true">
      <div className="reset-player-backdrop" onClick={onClose} />
      <section className="reset-player-panel">
        <button type="button" className="reset-player-close" onClick={onClose} aria-label="Close player">
          <X size={18} aria-hidden="true" />
        </button>

        {showCheckin ? (
          <PostSessionCheckin
            selectedFeeling={selectedFeeling}
            onSelectFeeling={setSelectedFeeling}
            selectedReflectionTag={selectedReflectionTag}
            onSelectReflectionTag={setSelectedReflectionTag}
            onSubmit={handleSubmitCheckin}
            isSaving={isSavingCheckin}
            isSaved={checkinSaved}
            saveError={checkinError}
            onReturn={onReturn}
            onClose={onClose}
          />
        ) : (
          <>
            <div className="reset-player-art">
              <img src={session.imageSrc} alt="" />
              <div />
            </div>
            <div className="reset-player-copy">
              <span>{session.type} · {session.category} · {session.duration} min</span>
              <h2>{session.title}</h2>
              <p>{session.whyThisHelps}</p>
              {isAmbientScript ? (
                <div className="reset-guidance-panel" aria-live="polite">
                  <span>Original timed guidance · {session.attribution}</span>
                  <p>{activeScriptStep?.text || "Press play and settle into the first breath."}</p>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="reset-audio-error">{error}</p>
            ) : (
              <div className="reset-player-controls">
                <button type="button" className="reset-play-button" onClick={togglePlayback}>
                  {isPlaying ? <Pause size={24} aria-hidden="true" /> : <Play size={24} aria-hidden="true" />}
                </button>
                <div className="reset-progress-wrap">
                  <div className="reset-time-row">
                    <span>{formatTime(progress)}</span>
                    <span>-{formatTime(remaining)}</span>
                  </div>
                  <div className="reset-range-wrap" style={{ "--progress": `${percent}%` }}>
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={Math.min(progress, duration || 0)}
                      onChange={handleSeek}
                      aria-label="Session progress"
                    />
                  </div>
                </div>
              </div>
            )}

            <audio ref={audioRef} preload="metadata" />
          </>
        )}
      </section>
    </div>
  );
}
