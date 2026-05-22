import { useEffect, useRef } from "react";

const LOOP_INTRO_VIDEO = "/media/loop-intro-story.mp4";

export default function LoopIntroVideo({ isOpen, onDismiss }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = 1;
      video.currentTime = 0;
      const playAttempt = video.play();
      if (playAttempt?.catch) {
        playAttempt.catch(() => {
          // Browser policies can still reject autoplay in rare cases.
          // The muted video remains visible and Skip is the only action.
        });
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loop-intro-video-title"
      className="loop-intro-video-overlay"
    >
      <section className="loop-intro-video-card">
        <div className="loop-intro-video-copy">
          <p className="loop-intro-video-kicker">The Loop</p>
          <h2 id="loop-intro-video-title">Before you begin</h2>
          <p>The Life Project is built to help you return to one honest action.</p>
        </div>

        <div className="loop-intro-video-frame">
          <video
            ref={videoRef}
            src={LOOP_INTRO_VIDEO}
            autoPlay
            playsInline
            controls={false}
            preload="auto"
            onEnded={onDismiss}
            aria-label="The Loop intro video"
          />
        </div>

        <button type="button" className="loop-intro-video-skip" onClick={onDismiss}>
          Skip
        </button>
      </section>
    </div>
  );
}
